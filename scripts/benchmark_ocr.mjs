// Local synthetic corpus. Freeze the split; compare segmentation modes on development only.
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
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
try {
  const base = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("exit", () => reject(Error("Server exited")));
    server.stdout.on("data", (b) => {
      const p = b.toString().match(/port (\d+)/)?.[1];
      if (p) resolve(`http://127.0.0.1:${p}/pages/`);
    });
  });
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/*", (r) =>
    new URL(r.request().url()).origin === new URL(base).origin
      ? r.continue()
      : r.abort(),
  );
  await page.goto(base);
  const report = await page.evaluate(async () => {
    const { challenge, DEVELOPMENT_SEEDS, HELD_OUT_SEEDS } = await import(
      "./challenge.js"
    );
    const { suggestText } = await import("./ocr.js");
    const { scoreChallenge } = await import("./challenge-score.js");
    const { erase } = await import("./exercise-core.js");
    const { BUILD } = await import("./build-info.js");
    const original = new Uint8ClampedArray(512 * 512 * 4).fill(100);
    for (let n = 3; n < original.length; n += 4) original[n] = 255;
    const cases = [];
    for (const [split, seeds, modes] of [
      ["development", DEVELOPMENT_SEEDS, ["6", "11"]],
      ["test", HELD_OUT_SEEDS, ["11"]],
    ])
      for (const seed of seeds)
        for (const mode of modes) {
          const s = challenge(original, 512, 512, seed);
          s.dirty = { pixels: s.pixels.slice() };
          const c = document.createElement("canvas");
          c.width = c.height = 512;
          c.getContext("2d").putImageData(
            new ImageData(s.pixels, 512, 512),
            0,
            0,
          );
          try {
            const result = await suggestText(c, { mode });
            const after = result.boxes.length
              ? erase(s.pixels, 512, 512, result.boxes)
              : s.pixels;
            cases.push({
              split,
              seed,
              mode,
              elapsed_ms: result.elapsed_ms,
              status: result.status,
              boxes: result.boxes.length,
              ...scoreChallenge(after, s),
            });
          } catch {
            cases.push({ split, seed, mode, status: "failed_unresolved" });
          }
        }
    return {
      schema: 1,
      app: BUILD,
      generator: "challenge-1",
      test_mode_fixed_before_run: "11",
      scope:
        "Synthetic ASCII bitmap text on a flat background only; not medical PHI sensitivity. Two segmentation settings of one engine, not two independent OCR engines.",
      memory: "Peak worker memory not measured; input bounded to 512 x 512.",
      cases,
    };
  });
  await mkdir("output/benchmarks", { recursive: true });
  await writeFile(
    "output/benchmarks/ocr.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      report.cases.map((c) => ({
        split: c.split,
        seed: c.seed,
        mode: c.mode,
        missed: c.missed_identifiers,
        total: c.identifier_count,
        status: c.status,
      })),
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
