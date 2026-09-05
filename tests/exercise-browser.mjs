import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, firefox, webkit } from "playwright";
import { decodePNG } from "./png-reader.mjs";
const catalog = JSON.parse(
  await readFile("src/dicom_workbench/web/teaching/catalog.json"),
);
const server = spawn(
  process.env.PYTHON || ".venv/bin/python",
  [
    "-u",
    "-m",
    "http.server",
    "0",
    "--bind",
    "127.0.0.1",
    "--directory",
    "output",
  ],
  { stdio: ["ignore", "pipe", "ignore"] },
);
let browser;
try {
  const serverBase = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.stdout.on("data", (b) => {
      const port = b.toString().match(/port (\d+)/)?.[1];
      if (port) resolve(`http://127.0.0.1:${port}/pages/`);
    });
  });
  const base = process.env.EXERCISE_BASE || serverBase;
  const chosen = process.env.SCAN_LIMIT
    ? catalog.slice(0, Number(process.env.SCAN_LIMIT))
    : catalog;
  await mkdir("output/exercise-checks", { recursive: true });
  for (const [engineName, engine] of Object.entries({
    chromium,
    firefox,
    webkit,
  })) {
    if (process.env.BROWSER && engineName !== process.env.BROWSER) continue;
    browser = await engine.launch();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      acceptDownloads: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (
        (!process.env.EXERCISE_BASE && req.method() !== "GET") ||
        url.origin !== new URL(base).origin
      ) {
        errors.push("Unexpected network request: " + req.url());
        return route.abort();
      }
      return route.continue();
    });
    const click = async (id) => {
      await page.locator("#exercise-" + id).click();
      await page.waitForFunction(
        () => !document.getElementById("exercise-close").disabled,
      );
    };
    const download = async (id, name) => {
      const [d] = await Promise.all([page.waitForEvent("download"), click(id)]);
      const path = `output/exercise-checks/${engineName}-${name}`;
      await d.saveAs(path);
      return readFile(path);
    };
    await page.goto(base);
    for (const [index, item] of chosen.entries()) {
      await page.locator("#browse-teaching").click();
      await page.locator("#teaching-card-" + item.id).click();
      await page.waitForFunction(
        () => !document.getElementById("teaching-workbench").disabled,
      );
      await page.locator("#teaching-workbench").click();
      await page.waitForFunction(
        () =>
          !document.getElementById("exercise").hidden &&
          !document.getElementById("exercise-close").disabled,
      );
      assert(await page.locator(".viewer").isHidden());
      assert.match(
        await page.locator("#exercise-title").textContent(),
        new RegExp(item.modality.replace("-", "\\-")),
      );
      await click("nonymise");
      assert.match(
        await page.locator("#exercise-fields").textContent(),
        /FAKE\^ALEX/,
      );
      const dirtyBytes = await download("dirty", `${index}-dirty.png`),
        dirty = decodePNG(dirtyBytes);
      assert.equal(dirty.text.PatientName, "FAKE^ALEX^EXAMPLE");
      assert.equal(Object.keys(dirty.text).length, 8);
      const dirtyReport = JSON.parse(
        await download("report", `${index}-before.json`),
      );
      assert.equal(
        dirtyReport.pixel_sha256,
        createHash("sha256").update(dirty.pixels).digest("hex"),
      );
      assert(dirtyReport.remaining_injected_label_pixels > 1000);
      await page.locator("#exercise-ack").check();
      assert(await page.locator("#exercise-save").isDisabled());
      if (index === 0) {
        await page
          .locator("#exercise-add")
          .evaluate((el) => (el.closest("details").open = true));
        await page.locator("#exercise-w").fill("");
        await click("add");
        assert.match(
          await page.locator("#exercise-status").textContent(),
          /Fill in/,
        );
        await page.locator("#exercise-w").fill("100");
        await click("add");
        await click("erase");
        const partial = JSON.parse(await download("report", "partial.json"));
        assert(partial.remaining_injected_label_pixels > 0);
        assert(await page.locator("#exercise-save").isDisabled());
      }
      // Exercise both step orders. Erasing must not resurrect previously scrubbed fields.
      if (index % 2 === 0) {
        await click("metadata");
        const middle = JSON.parse(
          await download("report", `${index}-metadata.json`),
        );
        assert.equal(middle.remaining_fake_fields.length, 0);
        assert(middle.remaining_injected_label_pixels > 0);
        if (index !== 0)
          assert.equal(middle.pixel_sha256, dirtyReport.pixel_sha256);
      }
      await click("select");
      await click("erase");
      if (index % 2 === 1) {
        assert(await page.locator("#exercise-save").isDisabled());
        await click("metadata");
      }
      await click("before");
      assert(await page.locator("#exercise-save").isDisabled());
      await click("before");
      const cleanedBytes = await download("save", `${index}-clean.png`),
        clean = decodePNG(cleanedBytes),
        report = JSON.parse(await download("report", `${index}-clean.json`));
      assert.deepEqual(Object.keys(clean.text), ["Source"]);
      assert(!cleanedBytes.includes(Buffer.from("FAKE")));
      assert.equal(report.all_added_details_removed, true);
      assert.equal(report.remaining_injected_label_pixels, 0);
      assert.equal(
        report.sha256,
        createHash("sha256").update(cleanedBytes).digest("hex"),
      );
      assert.equal(
        report.pixel_sha256,
        createHash("sha256").update(clean.pixels).digest("hex"),
      );
      assert.equal(clean.width, item.width);
      assert.equal(clean.height, item.height + 104);
      const start = 64 * clean.width * 4,
        end = (64 + item.height) * clean.width * 4;
      assert.deepEqual(
        clean.pixels.subarray(start, end),
        dirty.pixels.subarray(start, end),
      );
      for (const [lo, hi] of [
        [0, start],
        [end, clean.pixels.length],
      ])
        for (let n = lo; n < hi; n++)
          assert.equal(clean.pixels[n], n % 4 === 3 ? 255 : 0);
      if (index === 0) {
        if (engineName === "chromium") {
          await page
            .locator("#exercise")
            .screenshot({ path: "output/exercise-checks/desktop.png" });
          await page.setViewportSize({ width: 390, height: 844 });
          await page
            .locator("#exercise")
            .screenshot({ path: "output/exercise-checks/mobile.png" });
          assert(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          );
          await page.setViewportSize({ width: 1440, height: 1100 });
        }
        await click("restart");
        assert(await page.locator("#exercise-save").isDisabled());
        assert(await page.locator("#exercise-dirty").isDisabled());
        assert.match(
          await page.locator("#exercise-fields").textContent(),
          /Not added yet/,
        );
      }
      await click("close");
      assert(await page.locator("#exercise").isHidden());
      console.log(
        `${engineName}: ${index + 1}/50 ${item.id} — saved pixels and metadata independently checked`,
      );
    }
    assert.deepEqual(errors, []);
    await browser.close();
    browser = null;
  }
} finally {
  await browser?.close();
  server.kill();
}
