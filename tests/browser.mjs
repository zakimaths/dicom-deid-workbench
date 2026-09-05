// Real-browser regression passes. No remote service or patient data is used.
import assert from "node:assert/strict";
import { checkTeaching } from "./teaching.mjs";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium, firefox, webkit } from "playwright";

const python = process.env.PYTHON || ".venv/bin/python";
const server = spawn(
  python,
  ["-u", "-m", "dicom_workbench.cli", "serve", "--port", "0"],
  {
    env: { ...process.env, PYTHONPATH: "src" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const results = [];
const testedBrowsers = [];
let browser;
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Local test server did not start")),
      15000,
    );
    server.once("error", reject);
    server.once("exit", () => reject(new Error("Local test server exited")));
    server.stdout.on("data", (chunk) => {
      const url = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
  });
  await mkdir("output/browser", { recursive: true });
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    if (process.env.BROWSER && process.env.BROWSER !== name) continue;
    browser = await engine.launch({ headless: true });
    testedBrowsers.push(name);
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
      acceptDownloads: true,
    });
    page.setDefaultTimeout(15000);
    const errors = [],
      external = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => {
      // WebKit exposes browser-memory image loads to routing; these make no network request.
      const parsed = new URL(route.request().url());
      if (
        parsed.protocol === "blob:" &&
        parsed.origin === new URL(base).origin &&
        route.request().method() === "GET"
      )
        return route.continue();
      if (
        !route
          .request()
          .url()
          .startsWith(base + "/")
      ) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const pass = (label) => {
      results.push({ browser: name, check: label, passed: true });
      console.log(`${name}: ${label}`);
    };
    const idle = () =>
      page.waitForFunction(
        () =>
          document.querySelector(".workbench").getAttribute("aria-busy") ===
          "false",
      );
    const load = async (id, endpoint) => {
      const response = page.waitForResponse(
        (r) => r.url() === base + endpoint && r.request().method() === "POST",
      );
      await page.locator("#" + id).click();
      const data = await (await response).json();
      await idle();
      assert(await page.locator("#canvas").isVisible());
      assert(await page.locator("#add-region").isEnabled());
      return data;
    };
    const save = async (kind, filename) => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator("#" + kind).click(),
      ]);
      await download.saveAs(filename);
      return readFile(filename);
    };
    try {
      await checkTeaching(page, base, name);
      pass("50 labelled teaching images and library controls");
      await page.goto(base);
      await page.waitForFunction(
        () => !document.querySelector("#demo").disabled,
      );
      assert(await page.locator("#download").isDisabled());
      assert(await page.locator("#apply-regions").isDisabled());
      await page.locator("#browse-samples").click();
      assert.equal(await page.locator(".sample-options button").count(), 6);
      for (const control of await page.locator("button").all()) {
        assert(
          await control.getAttribute("aria-describedby"),
          "Every button needs student-friendly help",
        );
      }
      await page.locator("#sample-ct-a").hover();
      await page.waitForFunction(
        () => !document.querySelector("#button-help").hidden,
      );
      assert.match(await page.locator("#button-help").textContent(), /16 rows/);
      await page.keyboard.press("Escape");
      assert(await page.locator("#button-help").isHidden());
      await page.locator("#sample-ct-a").focus();
      assert(await page.locator("#button-help").isVisible());
      pass("Initial controls, six samples, hover and keyboard explanations");

      for (const [key, size] of [
        ["ct", 128],
        ["mr", 64],
        ["ct-a", 16],
        ["ct-b", 16],
        ["mr-a", 16],
        ["mr-b", 16],
      ]) {
        const data = await load("sample-" + key, "/api/samples/" + key);
        assert.equal(data.image.rows, size);
        assert(await page.locator("#download").isDisabled());
        const before = await page
          .locator("#canvas")
          .evaluate((c) => c.toDataURL());
        const center = await page.locator("#center").inputValue();
        await page.locator("#center").evaluate((c) => {
          c.value = c.max;
          c.dispatchEvent(new Event("input"));
        });
        await page.locator("#width").evaluate((c) => {
          c.value = "1";
          c.dispatchEvent(new Event("input"));
        });
        assert.notEqual(
          await page.locator("#canvas").evaluate((c) => c.toDataURL()),
          before,
        );
        await page.locator("#reset").click();
        assert.equal(await page.locator("#center").inputValue(), center);
        assert.equal(
          await page.locator("#canvas").evaluate((c) => c.toDataURL()),
          before,
        );
        const rgba = await page
          .locator("#canvas")
          .evaluate((c) =>
            Array.from(
              c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
            ),
          );
        await writeFile(
          `output/browser/${name}-${key}.rgba`,
          Buffer.from(rgba),
        );
        // The default rectangle must fit even the smallest public image.
        await page.locator("#add-region").click();
        assert.match(
          await page.locator("#region-status").textContent(),
          /1 rectangle/,
        );
        assert(await page.locator("#report").isDisabled());
        await page.locator("#ack").check();
        assert(await page.locator("#download").isDisabled());
        await page.locator("#undo-regions").click();
        assert(!(await page.locator("#ack").isChecked()));
        await page.locator("#ack").check();
        const bytes = await save(
          "download",
          `output/browser/${name}-${key}.dcm`,
        );
        assert.equal(
          createHash("sha256").update(bytes).digest("hex"),
          data.report.output_sha256,
        );
        const report = JSON.parse(
          await save("report", `output/browser/${name}-${key}.json`),
        );
        assert.deepEqual(report, data.report);
        pass(
          `${key}: preview, contrast/reset, selection/discard, DICOM/report downloads`,
        );
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const received = page.waitForResponse(
          (r) => r.url() === base + "/api/process",
        );
        await page
          .locator("#file")
          .setInputFiles(`output/browser/${name}-ct.dcm`);
        assert.equal((await received).status(), 200);
        await idle();
        assert(await page.locator("#canvas").isVisible());
        assert(await page.locator("#download").isDisabled());
      }
      const dropped = page.waitForResponse(
        (r) => r.url() === base + "/api/process",
      );
      await page.evaluate(
        (bytes) => {
          const data = new DataTransfer();
          data.items.add(
            new File([new Uint8Array(bytes)], "public-test.dcm", {
              type: "application/dicom",
            }),
          );
          document
            .querySelector("#dropzone")
            .dispatchEvent(
              new DragEvent("drop", { bubbles: true, dataTransfer: data }),
            );
        },
        [...(await readFile(`output/browser/${name}-mr.dcm`))],
      );
      assert.equal((await dropped).status(), 200);
      await idle();
      assert(await page.locator("#canvas").isVisible());
      pass("File picker, repeated same-file upload and drag-and-drop import");

      const exercise = await load("text-exercise", "/api/demo-text");
      await page.locator("#region-x").fill("");
      await page.locator("#add-region").click();
      assert(await page.locator("#apply-regions").isDisabled());
      await page.locator("#region-x").fill("99999");
      await page.locator("#add-region").click();
      assert(await page.locator("#apply-regions").isDisabled());
      await page.locator("#region-x").fill("16");
      await page.locator("#add-region").click();
      const reply = page.waitForResponse((r) =>
        r.url().endsWith("/api/redact"),
      );
      await page.locator("#apply-regions").click();
      const edited = await (await reply).json();
      await idle();
      assert.equal(edited.report.redaction.selected_pixels, 1848);
      assert.equal(edited.report.redaction.outside_regions_unchanged, true);
      assert.notEqual(edited.job, exercise.job);
      assert(await page.locator("#add-region").isDisabled());
      assert(await page.locator("#download").isDisabled());
      await page.locator("#ack").check();
      const bytes = await save("download", `output/browser/${name}-erased.dcm`);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        edited.report.output_sha256,
      );
      await save("report", `output/browser/${name}-erased.json`);
      pass(
        "Empty/out-of-bounds selections rejected; fake-text edit verified and downloaded",
      );

      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 950 });
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Overflow at ${width}`,
        );
      }
      await page.screenshot({
        path: `output/browser/${name}-mobile.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await load("demo", "/api/demo");
      await page.locator("#mark-region").click();
      await page.locator("#canvas").scrollIntoViewIfNeeded();
      const b = await page.locator("#canvas").boundingBox();
      await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.1);
      await page.mouse.up();
      assert.match(
        await page.locator("#region-status").textContent(),
        /1 rectangle/,
      );
      await page.locator("#undo-regions").click();
      await page.mouse.move(b.x + 10, b.y + 10);
      await page.mouse.down();
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert(await page.locator("#apply-regions").isDisabled());
      assert.equal(
        await page.locator("#mark-region").getAttribute("aria-pressed"),
        "false",
      );
      pass("Responsive layout, reverse drag and Escape cancellation");

      // Hold an old download until the user has changed the image or selection.
      for (const change of ["image", "selection"]) {
        let release, started;
        const holding = new Promise((resolve) => {
          release = resolve;
        });
        const requested = new Promise((resolve) => {
          started = resolve;
        });
        const pattern = "**/api/jobs/*/report";
        await page.route(pattern, async (route) => {
          const response = await route.fetch();
          started();
          await holding;
          await route.fulfill({ response });
        });
        await page.locator("#report").click();
        await requested;
        if (change === "image") await load("demo", "/api/demo");
        else {
          await page.locator("#add-region").click();
          await page.locator("#undo-regions").click();
        }
        const unexpected = page.waitForEvent("download", { timeout: 800 }).then(
          () => true,
          () => false,
        );
        release();
        assert.equal(await unexpected, false, "Old download must be discarded");
        await page.unroute(pattern);
      }
      pass("Delayed downloads discarded after image and selection changes");

      await page.locator("#file").setInputFiles({
        name: "SECRET-NAME.dcm",
        mimeType: "application/dicom",
        buffer: Buffer.from("PRIVATE_INVALID"),
      });
      await idle();
      assert(await page.locator("#canvas").isHidden());
      assert(await page.locator("#download").isDisabled());
      assert(
        !(await page.locator("body").textContent()).includes("SECRET-NAME"),
      );
      await load("demo", "/api/demo");
      await page.locator("#file").setInputFiles({
        name: "too-large.dcm",
        mimeType: "application/dicom",
        buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
      });
      await idle();
      assert.match(await page.locator("#status").textContent(), /8 MiB/);
      assert(await page.locator("#canvas").isHidden());
      await load("demo", "/api/demo");
      // Simulate an expired server result despite a still-visible preview.
      await page.route("**/api/jobs/*/report", (r) =>
        r.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({
            error: "This image has expired. Import it again.",
          }),
        }),
      );
      await page.locator("#report").click();
      await page.waitForFunction(
        () => document.querySelector("#canvas").hidden,
      );
      assert(await page.locator("#download").isDisabled());
      await page.unroute("**/api/jobs/*/report");
      pass("Malformed/oversized imports and expired exports clear stale state");

      await page.clock.install();
      await load("text-exercise", "/api/demo-text");
      await page.clock.runFor(590000);
      await page.locator("#add-region").click();
      await page.locator("#apply-regions").click();
      await idle();
      await page.clock.runFor(11000);
      assert(await page.locator("#canvas").isVisible());
      await page.clock.runFor(590000);
      assert(await page.locator("#canvas").isHidden());
      pass("Edited result gets a fresh ten-minute lifetime and then expires");
      await load("demo", "/api/demo");
      await page.locator("#clear").click();
      await page.waitForFunction(
        () => !document.querySelector("#demo").disabled,
      );
      assert(await page.locator("#canvas").isHidden());
      assert(await page.locator("#ack").isDisabled());
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
      pass("Clear, recovery, no browser exceptions and no external requests");
    } catch (error) {
      await page
        .screenshot({
          path: `output/browser/${name}-failure.png`,
          fullPage: true,
        })
        .catch(() => {});
      throw error;
    }
    await browser.close();
    browser = null;
  }
} finally {
  await browser?.close();
  const exited = once(server, "exit");
  server.kill("SIGINT");
  await exited;
  await writeFile(
    "output/browser/results.json",
    JSON.stringify(results, null, 2) + "\n",
  );
}

execFileSync(python, ["scripts/verify_browser_exports.py", ...testedBrowsers], {
  env: { ...process.env, PYTHONPATH: "src" },
  stdio: "inherit",
});
