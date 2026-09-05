import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "playwright";
const server = spawn(
  ".venv/bin/python",
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
  { stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
const results = [];
try {
  const base = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("exit", () => reject(new Error("Test server exited")));
    server.stdout.on("data", (b) => {
      const p = b.toString().match(/port (\d+)/)?.[1];
      if (p) resolve(`http://127.0.0.1:${p}/pages/`);
    });
  });
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  await mkdir("output/accessibility", { recursive: true });
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    browser = await engine.launch();
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
        acceptDownloads: true,
      });
      await page.addInitScript(() => {
        window.boxNumbers = [];
        const prototype = CanvasRenderingContext2D.prototype;
        const put = prototype.putImageData,
          fill = prototype.fillText;
        prototype.putImageData = function (...args) {
          if (this.canvas.id === "exercise-canvas") window.boxNumbers = [];
          return put.apply(this, args);
        };
        prototype.fillText = function (...args) {
          if (this.canvas.id === "exercise-canvas")
            window.boxNumbers.push(args[0]);
          return fill.apply(this, args);
        };
      });
      const errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", (route) => {
        const r = route.request();
        requests.push(r.url());
        if (
          new URL(r.url()).origin !== new URL(base).origin ||
          r.method() !== "GET"
        )
          return route.abort();
        return route.continue();
      });
      const click = async (id) => {
        await page.locator("#exercise-" + id).click();
        await page.waitForFunction(
          () => !document.getElementById("exercise-close").disabled,
        );
      };
      const audit = async (label) => {
        await page.evaluate(axe);
        const a = await page.evaluate(async () => {
          const r = await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
            },
          });
          return {
            violations: r.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => n.target),
            })),
            incomplete: r.incomplete.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                summary: n.failureSummary,
              })),
            })),
          };
        });
        results.push({ engine: name, width, state: label, ...a });
        assert.deepEqual(
          a.violations,
          [],
          `${name}/${width}/${label}: ${JSON.stringify(a.violations)}`,
        );
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "Horizontal page overflow",
        );
      };
      await page.goto(base);
      await audit("home");
      await page.locator("#browse-teaching").click();
      await audit("library");
      await page.keyboard.press("Escape");
      assert(
        await page
          .locator("#browse-teaching")
          .evaluate((e) => e === document.activeElement),
      );
      await page.locator("#browse-teaching").click();
      await page.waitForFunction(
        () => !document.getElementById("teaching-workbench").disabled,
      );
      await page.locator("#teaching-workbench").click();
      await page.locator("#exercise-mode").selectOption("challenge");
      await page.locator("#exercise-seed").fill("11");
      await click("nonymise");
      assert(await page.locator("#exercise-select").isHidden());
      await audit("challenge");
      await page.locator("#exercise-canvas").focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await page.locator("#exercise-x").inputValue(), "1");
      await page.keyboard.press("Shift+ArrowDown");
      assert.equal(await page.locator("#exercise-h").inputValue(), "21");
      await page.keyboard.press("Enter");
      assert.match(
        await page.locator("#exercise-selections").textContent(),
        /box 1/,
      );
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), ["1"]);
      await page.keyboard.press("Enter");
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), [
        "1",
        "2",
      ]);
      await page
        .getByRole("button", { name: "Remove box 1", exact: true })
        .click();
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), ["1"]);
      await page.locator("#exercise-canvas").focus();
      await page.keyboard.press("Tab");
      assert(
        !(await page
          .locator("#exercise-canvas")
          .evaluate((e) => e === document.activeElement)),
      );
      await page
        .locator("#exercise-x")
        .evaluate((e) => (e.closest("details").open = true));
      await click("discard");
      await click("metadata");
      await click("undo");
      assert.match(
        await page.locator("#exercise-fields").textContent(),
        /FAKE\^PERSON/,
      );
      await click("score");
      assert.match(
        await page.locator("#exercise-score-result").textContent(),
        /4 \/ 4/,
      );
      await click("reveal");
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), [
        "1",
        "2",
        "3",
        "4",
      ]);
      await page
        .locator("#exercise-canvas")
        .screenshot({
          path: `output/accessibility/numbered-${name}-${width}.png`,
        });
      await click("before");
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), []);
      await click("before");
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), [
        "1",
        "2",
        "3",
        "4",
      ]);
      await click("erase");
      assert.deepEqual(await page.evaluate(() => window.boxNumbers), []);
      await click("metadata");
      await page.locator("#exercise-ack").check();
      await click("score");
      assert.match(
        await page.locator("#exercise-score-result").textContent(),
        /0 \/ 4/,
      );
      assert(await page.locator("#exercise-save").isEnabled());
      await click("undo");
      assert(await page.locator("#exercise-save").isDisabled());
      await click("metadata");
      const pictureWidth = () =>
        page
          .locator("#exercise-canvas")
          .evaluate((e) => e.getBoundingClientRect().width);
      const fitted = await pictureWidth();
      assert(await page.locator("#exercise-zoom-fit").isDisabled());
      assert(
        await page
          .locator("#exercise-canvas")
          .evaluate(
            (e) => e.getBoundingClientRect().height <= innerHeight * 0.75,
          ),
      );
      await click("zoom");
      assert(Math.abs((await pictureWidth()) - fitted * 1.5) < 1);
      await audit("scored-zoom");
      await click("zoom-out");
      assert(Math.abs((await pictureWidth()) - fitted) < 1);
      await click("zoom-out");
      assert(Math.abs((await pictureWidth()) - fitted * 0.75) < 1);
      await audit("zoom-out");
      await click("zoom-out");
      await click("zoom-out");
      assert(await page.locator("#exercise-zoom-out").isDisabled());
      await click("zoom-fit");
      assert(Math.abs((await pictureWidth()) - fitted) < 1);
      for (let i = 0; i < 4; i++) await click("zoom");
      assert(await page.locator("#exercise-zoom").isDisabled());
      await click("zoom-fit");
      await page
        .locator("#exercise-all-help")
        .evaluate((el) => (el.closest("details").open = true));
      await page.screenshot({
        path: `output/accessibility/${name}-${width}.png`,
        fullPage: true,
      });
      if (name === "chromium") {
        await page.locator("#exercise-title").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `output/accessibility/viewport-${width}.png`,
        });
      }
      if (width === 1440) {
        await click("restart");
        await page.locator("#exercise-mode").selectOption("guided");
        await click("nonymise");
        await page.locator("#exercise-ocr").click();
        await page.waitForFunction(
          () => !document.getElementById("exercise-cancel").disabled,
        );
        await page.locator("#exercise-cancel").click();
        await page.waitForFunction(
          () => !document.getElementById("exercise-close").disabled,
        );
        assert.match(
          await page.locator("#exercise-ocr-status").textContent(),
          /stopped|failed/,
        );
        await Promise.all(page.workers().map((worker) =>
          worker.waitForEvent("close", { timeout: 5000 })));
        assert.equal(page.workers().length, 0, "Cancelled OCR worker leaked");
        await click("ocr");
        assert.match(
          await page.locator("#exercise-ocr-status").textContent(),
          /possible text boxes/,
        );
        assert.deepEqual(
          requests.filter((u) => new URL(u).origin !== new URL(base).origin),
          [],
          "Non-local request",
        );
        await audit("ocr-review");
        await Promise.all(page.workers().map((worker) =>
          worker.waitForEvent("close", { timeout: 5000 })));
        assert.equal(page.workers().length, 0, "Completed OCR worker leaked");
        const timeoutResult = await page.evaluate(async () => {
          const { suggestText } = await import("./ocr.js");
          const c = document.createElement("canvas");
          c.width = c.height = 512;
          try {
            await suggestText(c, { timeout: 1 });
            return "unexpected_success";
          } catch (e) {
            return e.message;
          }
        });
        assert.match(timeoutResult, /stopped/);
        await page.waitForTimeout(100);
        assert.equal(
          page.workers().length,
          0,
          "Timed out startup worker leaked",
        );
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    await browser.close();
    browser = null;
  }
} finally {
  await writeFile(
    "output/accessibility/results.json",
    JSON.stringify(results, null, 2),
  );
  await browser?.close();
  server.kill();
}
console.log(
  `${results.length} accessibility scans passed; keyboard, zoom, undo, cancellation and OCR review checked.`,
);
