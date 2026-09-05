import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
const server = spawn(
  ".venv/bin/python",
  ["-u", "-m", "dicom_workbench.cli", "serve", "--port", "0"],
  {
    env: { ...process.env, PYTHONPATH: "src" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let browser;
const audits = [];
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Local server timeout")),
      15000,
    );
    server.once("error", reject);
    server.once("exit", () => reject(new Error("Server exited")));
    server.stdout.on("data", (b) => {
      const url = b.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
  });
  await mkdir("output/records-browser", { recursive: true });
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    browser = await engine.launch();
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        acceptDownloads: true,
        reducedMotion: "reduce",
      });
      page.setDefaultTimeout(20000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === base
          ? route.continue()
          : route.abort(),
      );
      await page.goto(base + "/records");
      async function audit(state) {
        await page.evaluate(axe);
        const result = await page.evaluate(async () => {
          const a = await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
            },
          });
          return {
            violations: a.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => n.target),
            })),
            incomplete: a.incomplete.map((v) => v.id),
          };
        });
        audits.push({ name, width, state, ...result });
        assert.deepEqual(
          result.violations,
          [],
          JSON.stringify(result.violations),
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
      }
      await audit("empty");
      await page.locator("#record-file").setInputFiles({name:"note.txt",mimeType:"text/plain",buffer:Buffer.from("😀 Discussed care with Robin Sample today.")});
      await page.waitForFunction(()=>document.getElementById("record-status").textContent.startsWith("Text loaded"));
      await page.locator("#source-text").evaluate(el=>{const start=el.value.indexOf("Robin Sample");el.focus();el.setSelectionRange(start,start+12);});
      await page.locator("#record-select").click();await page.locator("#record-apply").click();
      await page.waitForFunction(()=>document.getElementById("record-status").textContent.startsWith("Text replacements checked"));
      assert.equal(await page.locator("#clean-text").inputValue(),"😀 Discussed care with █████ ██████ today.");
      await page.locator("#record-example").click();
      // Add the deliberately missed name manually, then rerun suggestions; it must remain.
      await page.locator("#source-text").evaluate((el) => {
        const start = el.value.indexOf("Robin Sample");
        el.focus();
        el.setSelectionRange(start, start + 12);
      });
      await page.locator("#record-select").click();
      await page.locator("#record-detect").click();
      await page.waitForFunction(() =>
        document
          .getElementById("record-status")
          .textContent.startsWith("Suggestions ready"),
      );
      await page.locator("#record-apply").click();
      await page.waitForFunction(() =>
        document
          .getElementById("record-status")
          .textContent.startsWith("Text replacements checked"),
      );
      const clean = await page.locator("#clean-text").inputValue();
      for (const secret of [
        "Alex Example",
        "Robin Sample",
        "AB-458921",
        "alex@example.org",
        "14/02/1970",
        "12 Example Road",
      ])
        assert.ok(!clean.includes(secret), secret);
      assert.ok(clean.includes("No acute fracture"));
      assert.ok(await page.locator("#record-save").isDisabled());
      await page.locator("#review-privacy").check();
      await page.locator("#review-utility").check();
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#record-save").click();
      const download = await downloadPromise;
      assert.equal(download.suggestedFilename(), "reviewed-record.txt");
      assert.equal(await readFile(await download.path(), "utf8"), clean);
      await audit("reviewed-text");
      await page.screenshot({
        path: `output/records-browser/${name}-${width}-text.png`,
        fullPage: true,
      });
      // Any edit invalidates both export acknowledgements.
      await page.locator("#known-values").fill("Changed");
      assert.ok(await page.locator("#record-save").isDisabled());
      await page.locator("#record-clear").click();
      // Real image file import, anonymous filename and actual saved-pixel checks.
      const imageBytes = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 256;
        const x = c.getContext("2d");
        x.fillStyle = "white";
        x.fillRect(0, 0, 512, 256);
        x.fillStyle = "black";
        x.font = "30px sans-serif";
        x.fillText("FAKE PATIENT 458921", 10, 45);
        return Array.from(atob(c.toDataURL().split(",")[1]), (c) =>
          c.charCodeAt(0),
        );
      });
      await page
        .locator("#record-file")
        .setInputFiles({
          name: "PRIVATE_NAME.png",
          mimeType: "image/png",
          buffer: Buffer.from(imageBytes),
        });
      await page.waitForFunction(() =>
        document
          .getElementById("record-status")
          .textContent.startsWith("Picture loaded"),
      );
      await page.locator("#image-zoom").click();
      assert.equal(
        await page.locator("#image-zoom").getAttribute("aria-pressed"),
        "true",
      );
      await page.locator("#image-zoom").click();
      await page.locator("#box-w").fill("512");
      await page.locator("#box-h").fill("65");
      await page.locator("#image-add").click();
      await page.locator("#image-apply").click();
      await page.waitForFunction(() =>
        document
          .getElementById("record-status")
          .textContent.startsWith("Image replacements checked"),
      );
      await page.locator("#review-privacy").check();
      await page.locator("#review-utility").check();
      const pngPromise = page.waitForEvent("download");
      await page.locator("#record-save").click();
      const png = await pngPromise;
      assert.equal(png.suggestedFilename(), "reviewed-image.png");
      const raw = await readFile(await png.path());
      // Independent PNG reader from the previous suite, plus reopened pixel values.
      const pixels = await page.evaluate(async (bytes) => {
        const bitmap = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        );
        const c = document.createElement("canvas");
        c.width = bitmap.width;
        c.height = bitmap.height;
        const x = c.getContext("2d");
        x.drawImage(bitmap, 0, 0);
        bitmap.close();
        return Array.from(x.getImageData(0, 0, c.width, c.height).data);
      }, Array.from(raw));
      for (let y = 0; y < 256; y++)
        for (let x = 0; x < 512; x++) {
          const n = (y * 512 + x) * 4;
          assert.deepEqual(
            pixels.slice(n, n + 4),
            y < 65 ? [0, 0, 0, 255] : [255, 255, 255, 255],
          );
        }
      await audit("reviewed-image");
      await page.screenshot({
        path: `output/records-browser/${name}-${width}-image.png`,
        fullPage: true,
      });
      if (width === 1440) {
        await page.locator("#image-reset").click();
        await page.locator("#image-ocr").click();
        await page.waitForFunction(
          () => !document.getElementById("image-ocr").disabled,
          {},
          { timeout: 45000 },
        );
        assert.ok(
          (await page.locator("#record-status").textContent()).includes(
            "proposed text boxes",
          ),
        );
        assert.equal(page.workers().length, 0);
      }
      if(name === "chromium" && width === 1440) {
        // Clear while the output digest is pending must not resurrect a stale result.
        await page.evaluate(()=>{const original=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args)=>{const value=await original(...args);return new Promise(resolve=>{window.releaseDigest=()=>resolve(value);});};});
        await page.locator("#image-apply").click();
        await page.waitForFunction(()=>typeof window.releaseDigest === "function");
        await page.locator("#record-clear").click();
        await page.evaluate(()=>window.releaseDigest());
        await page.waitForFunction(()=>document.getElementById("record-export").hidden && document.getElementById("record-save").disabled);
      }
      // Invalid import cannot leave a previous export available.
      await page
        .locator("#record-file")
        .setInputFiles({
          name: "bad.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("not a PDF"),
        });
      await page.waitForFunction(() =>
        document
          .getElementById("record-status")
          .textContent.startsWith("Could not finish"),
      );
      assert.ok(await page.locator("#record-save").isDisabled());
      assert.ok(await page.locator("#record-export").isHidden());
      assert.deepEqual(errors, []);
      await page.close();
    }
    await browser.close();
    browser = null;
  }
  await writeFile(
    "output/records-browser/results.json",
    JSON.stringify(audits, null, 2),
  );
  console.log(
    `${audits.length} accessibility states and six complete local record/image flows passed.`,
  );
} finally {
  await browser?.close();
  server.kill();
}
