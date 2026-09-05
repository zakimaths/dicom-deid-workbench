import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
await mkdir("output/mobile-audit", { recursive: true });
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
  { stdio: ["ignore", "pipe", "ignore"] },
);
const base = await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("Mobile test server did not start")),
    15000,
  );
  server.once("error", reject);
  server.once("exit", () => reject(new Error("Mobile test server exited")));
  server.stdout.on("data", (b) => {
    const p = b.toString().match(/port (\d+)/)?.[1];
    if (p) {
      clearTimeout(timer);
      resolve(`http://127.0.0.1:${p}/pages/`);
    }
  });
});
const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const results = [];
let b;
try {
  for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
    b = await engine.launch();
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [844, 390],
      [768, 1024],
    ]) {
      const page = await b.newPage({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        reducedMotion: "reduce",
        acceptDownloads: true,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      async function audit(state) {
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
              nodes: v.nodes.map((n) => n.target),
            })),
            incomplete: r.incomplete.map((v) => v.id),
          };
        });
        const layout = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          overflowElements: [...document.querySelectorAll("body *")]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.width &&
                r.right > innerWidth + 2 &&
                !e.closest("canvas,.exercise-stage,.sample-library")
              );
            })
            .slice(0, 12)
            .map((e) => ({
              tag: e.tagName,
              id: e.id,
              class: e.className,
              width: e.getBoundingClientRect().width,
            })),
        }));
        results.push({
          engineName,
          width,
          height,
          state,
          ...a,
          ...layout,
          errors: [...errors],
        });
        if (["home", "library", "selected", "large-text"].includes(state)) {
          if (state === "selected")
            await page.locator("#exercise-canvas").scrollIntoViewIfNeeded();
          if (state === "large-text")
            await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `output/mobile-audit/${engineName}-${width}-${height}-${state}.png`,
          });
        }
      }
      const tap = async (id) => {
        await page.locator("#" + id).tap();
        await page.waitForFunction(
          () => !document.getElementById("exercise-close").disabled,
        );
      };
      await page.goto(base);
      await audit("home");
      await page.locator("#browse-teaching").tap();
      await page.waitForFunction(
        () => !document.getElementById("teaching-workbench").disabled,
      );
      await audit("library");
      await page.locator("#teaching-workbench").tap();
      await page.waitForFunction(
        () => !document.getElementById("exercise-close").disabled,
      );
      await tap("exercise-nonymise");
      await tap("exercise-select");
      await audit("selected");
      await tap("exercise-zoom");
      await audit("zoom-in");
      await tap("exercise-zoom-out");
      await tap("exercise-zoom-out");
      await audit("zoom-out");
      await tap("exercise-erase");
      await tap("exercise-metadata");
      await page.locator("#exercise-ack").check();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        tap("exercise-save"),
      ]);
      await download.saveAs(
        `output/mobile-audit/${engineName}-${width}-${height}.png`,
      );
      await audit("scrubbed");
      // Browser-sized text enlargement: double each element's computed type size once.
      await page.evaluate(() => {
        const values = [...document.querySelectorAll("body *")].map((e) => [
          e,
          parseFloat(getComputedStyle(e).fontSize),
        ]);
        for (const [e, size] of values) e.style.fontSize = `${size * 2}px`;
      });
      await audit("large-text");
      await page.locator(".skip-link").focus();
      const skip = await page.locator(".skip-link").boundingBox();
      assert(
        skip.x >= 0 &&
          skip.x + skip.width <= width &&
          skip.y >= 0 &&
          skip.y + skip.height <= height,
      );
      await audit("skip-link");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "main",
      );
      await page.close();
    }
    await b.close();
    b = null;
  }
} finally {
  if (b) await b.close();
  server.kill();
  await writeFile(
    "output/mobile-audit/results.json",
    JSON.stringify(results, null, 2),
  );
  if (results.some((r) => r.violations.length || r.overflow || r.errors.length))
    process.exitCode = 1;
  console.log(
    JSON.stringify(
      {
        states: results.length,
        findings: results
          .filter((r) => r.violations.length || r.overflow || r.errors.length)
          .map(
            ({
              engineName,
              width,
              height,
              state,
              violations,
              overflow,
              overflowElements,
              errors,
            }) => ({
              engineName,
              width,
              height,
              state,
              violations,
              overflow,
              overflowElements,
              errors,
            }),
          ),
      },
      null,
      2,
    ),
  );
}
