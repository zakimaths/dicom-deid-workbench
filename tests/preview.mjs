import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
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
const checks = [];
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Static server did not start")),
      10000,
    );
    server.once("error", reject);
    server.stdout.on("data", (chunk) => {
      const port = chunk.toString().match(/port (\d+)/)?.[1];
      if (port) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${port}/pages/`);
      }
    });
  });
  await mkdir("output/preview-checks", { recursive: true });
  for (const [engineName, engine] of Object.entries({
    chromium,
    firefox,
    webkit,
  })) {
    if (process.env.BROWSER && process.env.BROWSER !== engineName) continue;
    browser = await engine.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      acceptDownloads: true,
    });
    const failures = [],
      requests = [];
    page.on("pageerror", (e) => failures.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") failures.push(m.text());
    });
    await page.route("**/*", (route) => {
      const request = route.request();
      requests.push({ url: request.url(), method: request.method() });
      if (!request.url().startsWith(base) || request.method() !== "GET")
        return route.abort();
      return route.continue();
    });
    const load = async (id) => {
      await page.locator("#" + id).click();
      await page.waitForFunction(
        () =>
          document.querySelector(".workbench").getAttribute("aria-busy") ===
            "false" && !document.querySelector("#canvas").hidden,
      );
    };
    const download = async (id, path) => {
      const [d] = await Promise.all([
        page.waitForEvent("download"),
        page.locator("#" + id).click(),
      ]);
      await d.saveAs(path);
      return readFile(path);
    };
    await page.goto(base);
    assert.equal(await page.locator("input[type=file]").count(), 0);
    assert.equal(await page.locator("form").count(), 0);
    assert(
      await page.locator('meta[http-equiv="Content-Security-Policy"]').count(),
    );
    assert.match(await page.locator("#download").textContent(), /PNG/);
    await page.locator("#browse-samples").click();
    for (const id of [
      "demo",
      "sample-ct",
      "sample-mr",
      "sample-ct-a",
      "sample-ct-b",
      "sample-mr-a",
      "sample-mr-b",
      "text-exercise",
    ]) {
      await load(id);
      assert(await page.locator("#download").isDisabled());
      const original = await page
        .locator("#canvas")
        .evaluate((c) => c.toDataURL());
      await page.locator("#width").evaluate((c) => {
        c.value = "1";
        c.dispatchEvent(new Event("input"));
      });
      assert.notEqual(
        await page.locator("#canvas").evaluate((c) => c.toDataURL()),
        original,
      );
      await page.locator("#reset").click();
      assert.equal(
        await page.locator("#canvas").evaluate((c) => c.toDataURL()),
        original,
      );
    }
    await page.locator("#add-region").click();
    assert(await page.locator("#download").isDisabled());
    assert(await page.locator("#report").isDisabled());
    await page.locator("#undo-regions").click();
    await page.locator("#add-region").click();
    await page.locator("#apply-regions").click();
    assert.match(
      await page.locator("#integrity-title").textContent(),
      /replaced/,
    );
    assert(await page.locator("#download").isDisabled());
    await page.locator("#ack").check();
    const png = await download(
      "download",
      `output/preview-checks/${engineName}.png`,
    );
    assert.deepEqual(
      [...png.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
    const report = JSON.parse(
      await download("report", `output/preview-checks/${engineName}.json`),
    );
    assert.equal(report.preview_schema, 1);
    assert.equal(report.export_format, "PNG");
    assert.deepEqual(report.applied_rectangles, [
      { x: 16, y: 12, width: 132, height: 14 },
    ]);
    // Verify the rendered erased area, not only the application status message.
    assert(
      await page.locator("#canvas").evaluate((c) => {
        const d = c.getContext("2d").getImageData(16, 12, 132, 14).data;
        for (let n = 0; n < d.length; n += 4)
          if (d[n] || d[n + 1] || d[n + 2] || d[n + 3] !== 255) return false;
        return true;
      }),
    );
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      // WebKit screenshot capture injects a stylesheet blocked by this CSP.
      // Keep the policy enforced and capture Chromium/Firefox; all engines check layout.
      if (width !== 390 && engineName !== "webkit")
        await page.screenshot({
          path: `output/preview-checks/${engineName}-${width}.png`,
          fullPage: true,
          caret: "initial",
        });
    }
    await page.locator("#clear").click();
    assert(await page.locator("#canvas").isHidden());
    await page.evaluate(() => {
      const d = new DataTransfer();
      d.items.add(new File(["PRIVATE"], "private.dcm"));
      window.dispatchEvent(
        new DragEvent("drop", { dataTransfer: d, bubbles: true }),
      );
    });
    assert(await page.locator("#canvas").isHidden());
    assert.match(await page.locator("#status").textContent(), /samples only/);
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    assert.equal(await page.evaluate(() => document.cookie), "");
    assert(
      requests.every(
        (r) =>
          r.method === "GET" &&
          r.url.startsWith(base) &&
          !r.url.includes("/api/"),
      ),
    );
    assert.deepEqual(failures, []);
    checks.push({
      engine: engineName,
      passed: true,
      scope:
        "Eight samples, contrast/reset, selection/discard/edit, PNG/report exports, clear, refused file drop, responsive layout, no storage/cookies/API or off-origin requests",
    });
    console.log(`${engineName}: static preview checks passed`);
    await browser.close();
    browser = null;
  }
} finally {
  await browser?.close();
  const stopped = once(server, "exit");
  server.kill("SIGINT");
  await stopped;
  await writeFile(
    "output/preview-checks/results.json",
    JSON.stringify(checks, null, 2) + "\n",
  );
}
