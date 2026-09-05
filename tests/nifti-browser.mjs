import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
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
const results = [];
try {
  const base = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Error("server timeout")), 15000);
    server.stdout.on("data", (b) => {
      const m = b.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (m) {
        clearTimeout(t);
        resolve(m[0]);
      }
    });
    server.once("error", reject);
  });
  await mkdir("output/nifti-browser", { recursive: true });
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  for (const [name, engine] of Object.entries(
    process.env.SMOKE ? { chromium } : { chromium, firefox, webkit },
  )) {
    browser = await engine.launch();
    for (const width of process.env.SMOKE ? [1280] : [1280, 390, 320]) {
      const page = await browser.newPage({
        viewport: { width, height: 950 },
        acceptDownloads: true,
      });
      page.setDefaultTimeout(30000);
      const errors = [],
        external = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        if (new URL(route.request().url()).origin !== base) {
          external.push(route.request().url());
          return route.abort();
        }
        return route.continue();
      });
      await page.goto(base + "/nifti");
      await page.locator("#phantom").click();
      await page.waitForFunction(
        () =>
          !document.getElementById("clean").disabled ||
          /could not|unavailable/.test(
            document.getElementById("status").textContent,
          ),
      );
      const message = await page.locator("#status").textContent();
      console.log(name, width, message, errors);
      assert.match(message, /Volume ready/);
      assert.match(
        await page.locator("#header-findings").textContent(),
        /3 text fields.*1 extensions/,
      );
      await page
        .locator("#canvas-host canvas")
        .screenshot({
          path: `output/nifti-browser/${name}-${width}-orientation.png`,
        });
      const before = await page.locator("#slice").inputValue();
      await page.locator("#next").click();
      assert.equal(
        Number(await page.locator("#slice").inputValue()),
        Number(before) + 1,
      );
      for (const plane of ["1", "2", "0"]) {
        await page.locator("#plane").selectOption(plane);
        assert.match(await page.locator("#position").textContent(), /slice/);
      }
      await page.locator("#zoom").fill("50");
      await page.locator("#zoom").dispatchEvent("input");
      assert.equal(await page.locator("#zoom-number").textContent(), "50%");
      await page.locator("#fit").click();
      await page.locator("#contrast").fill("150");
      await page.locator("#contrast").dispatchEvent("input");
      await page.locator("#reset").click();
      await page.locator("#clean").click();
      await page.waitForFunction(() =>
        document
          .getElementById("verification")
          .textContent.startsWith("Header cleaned."),
      );
      assert(await page.locator("#save-volume").isDisabled());
      await page.locator("#review-limit").check();
      await page.locator("#review-extension").check();
      const pending = page.waitForEvent("download");
      await page.locator("#save-volume").click();
      const d = await pending;
      await d.saveAs(`output/nifti-browser/${name}-${width}.nii`);
      await page.evaluate(axe);
      const audit = await page.evaluate(async () => {
        const a = await axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return a.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        }));
      });
      assert.deepEqual(audit, []);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.locator("#brain").click();
      await page.waitForFunction(
        () =>
          document
            .getElementById("volume-title")
            .textContent.startsWith("Brain MRI") &&
          !document.getElementById("volume-work").hidden,
      );
      await page.locator("#volume-work").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/nifti-browser/${name}-${width}.png`,
        fullPage: true,
      });
      await page
        .locator("#volume-file")
        .setInputFiles({
          name: "broken.nii",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("not a scan"),
        });
      await page.waitForFunction(
        () => document.getElementById("volume-work").hidden,
      );
      assert(await page.locator("#save-volume").isDisabled());
      await page.locator("#phantom").click();
      await page.locator("#clear").click();
      await page.waitForTimeout(300);
      assert(await page.locator("#volume-work").isHidden());
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      results.push({
        engine: name,
        width,
        accessibilityViolations: audit,
        errors,
        externalRequests: external,
        export: "independently checked by Python",
      });
      await page.close();
    }
    await browser.close();
    browser = null;
  }
  await writeFile(
    "output/nifti-browser/results.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
