import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
const server = createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://localhost").pathname;
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
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  await mkdir("output/nifti-preview", { recursive: true });
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    browser = await engine.launch();
    for (const width of [1280, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      const errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (r) => {
        const u = new URL(r.request().url());
        requests.push(u.href);
        return u.origin === base ? r.continue() : r.abort();
      });
      await page.goto(base + "/");
      await page.locator("#nifti-link").click();
      assert(page.url().endsWith("/nifti.html"));
      assert.equal(await page.locator("input[type=file]").count(), 0);
      for (const id of ["phantom", "brain"]) {
        await page.locator("#" + id).click();
        await page.waitForFunction(() =>
          document
            .getElementById("status")
            .textContent.startsWith("Volume ready"),
        );
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
