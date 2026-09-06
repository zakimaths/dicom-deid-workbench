import { defaceFlow } from "./deface-flow.mjs";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    const prefix = "/dicom-deid-workbench/";
    if (!path.startsWith(prefix)) throw Error();
    const p = path.slice(prefix.length - 1);
    if (p.includes("..")) throw Error();
    const b = await readFile("output/pages" + (p === "/" ? "/index.html" : p));
    res.setHeader(
      "Content-Type",
      p.endsWith(".js")
        ? "text/javascript"
        : p.endsWith(".css")
          ? "text/css"
          : p.endsWith(".html") || p === "/"
            ? "text/html"
            : "application/octet-stream",
    );
    res.end(b);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = origin + "/dicom-deid-workbench";
let browser;
const results = [];
try {
  await mkdir("output/nifti-preview", { recursive: true });
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    browser = await engine.launch({
      headless: process.env.NIFTI_HEADED !== "1",
      ...(name === "firefox" && process.platform === "linux"
        ? { firefoxUserPrefs: { "webgl.force-enabled": true } }
        : {}),
    });
    for (const width of [1280, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) => {
        const u = new URL(r.request().url());
        requests.push(u.href);
        return u.origin === origin ? r.continue() : r.abort();
      });
      console.log("Starting public NIfTI", name, width);
      await page.goto(base + "/");
      await page.locator("#nifti-link").click();
      assert(page.url().endsWith("/nifti.html"));
      assert.equal(await page.locator("input[type=file]").count(), 0);
      for (const id of ["phantom", "brain"]) {
        await page.locator("#" + id).click();
        await page.waitForFunction(() =>
          /Volume ready|could not|unavailable/.test(
            document.getElementById("status").textContent,
          ),
        );
        assert.match(await page.locator("#status").textContent(), /Volume ready/,
          `${name} ${width} ${id}`);
        await page.locator("#next").click();
      }
      await page.evaluate(axe);
      const violations = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          })
        ).violations.map((v) => v.id),
      );
      assert.deepEqual(violations, []);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: `output/nifti-preview/${name}-${width}.png`,
        fullPage: true,
      });
      await defaceFlow(page, { local: false, name, width });
      await page.route("**/nifti-assets/phantom.nii.gz", (r) =>
        r.fulfill({ body: "corrupt sample" }),
      );
      await page.locator("#phantom").click();
      await page.waitForFunction(() =>
        document.getElementById("status").textContent.includes("could not"),
      );
      assert(await page.locator("#volume-work").isHidden());
      assert.equal(await page.locator("#save-volume").count(), 0);
      assert.deepEqual(errors, []);
      assert(!requests.some((u) => !u.startsWith(base) || u.includes("/api/")));
      results.push({
        name,
        width,
        errors,
        violations,
        onlySameOriginRequests: true,
        noApiRequests: true,
      });
      await page.close();
    }
    const unavailable = await browser.newPage();
    const unavailableErrors = [];
    unavailable.on("pageerror", (e) => unavailableErrors.push(e.message));
    await unavailable.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === "webgl2" ? null : original.call(this, kind, ...args);
      };
    });
    await unavailable.goto(base + "/nifti.html");
    await unavailable.locator("#phantom").click();
    await unavailable.waitForFunction(() =>
      document.getElementById("status").textContent.includes("WebGL2 graphics are required"));
    assert(await unavailable.locator("#volume-work").isHidden());
    assert.deepEqual(unavailableErrors, []);
    await unavailable.locator("#clear").click();
    assert.match(await unavailable.locator("#status").textContent(), /Volume cleared/);
    await unavailable.close();
    console.log(name, "unavailable graphics handled without an uncaught error");
    await browser.close();
    browser = null;
  }
  await writeFile(
    "output/nifti-preview/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log("6 public NIfTI workflows passed");
} finally {
  await browser?.close();
  server.close();
}
