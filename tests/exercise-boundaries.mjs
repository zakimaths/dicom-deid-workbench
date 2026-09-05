import assert from "node:assert/strict";
export async function checkExerciseBoundaries(page, base, local = false) {
  await page.goto(base);
  let count = 0;
  const note = () => count++;
  page.on("download", note);
  await page.locator("#demo").click();
  await page.waitForFunction(
    () =>
      !document.getElementById("canvas").hidden &&
      document.querySelector(".workbench").getAttribute("aria-busy") ===
        "false",
  );
  await page.locator("#ack").check();
  let release;
  if (local) {
    const gate = new Promise((r) => (release = r));
    await page.route("**/api/jobs/*/dicom", async (route) => {
      await gate;
      await route.continue();
    });
  } else {
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, ...args) {
        return original.call(
          this,
          this.id === "canvas"
            ? (blob) => {
                window.releaseOldExport = () => cb(blob);
              }
            : cb,
          ...args,
        );
      };
    });
  }
  await page.locator("#download").click();
  if (!local) await page.waitForFunction(() => !!window.releaseOldExport);
  await page.locator("#browse-teaching").click();
  await page.waitForFunction(
    () => !document.getElementById("teaching-workbench").disabled,
  );
  await page.locator("#teaching-workbench").click();
  await page.waitForFunction(() => !document.getElementById("exercise").hidden);
  if (local) {
    const response = page.waitForResponse((r) => r.url().endsWith("/dicom"));
    release();
    await response;
    await page.unroute("**/api/jobs/*/dicom");
  } else await page.evaluate(() => window.releaseOldExport());
  await page.waitForTimeout(200);
  assert.equal(count, 0, "An old export escaped into the teaching exercise");
  await page.locator("#exercise-close").click();
  assert(await page.locator(".viewer").isVisible());
  // Closing the library while PNG encoding is pending must cancel activation.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (cb, ...args) {
      return original.call(
        this,
        (blob) => {
          window.releaseExerciseOpen = () => cb(blob);
        },
        ...args,
      );
    };
  });
  await page.locator("#browse-teaching").click();
  await page.waitForFunction(
    () => !document.getElementById("teaching-workbench").disabled,
  );
  await page.locator("#teaching-workbench").click();
  await page.waitForFunction(() => !!window.releaseExerciseOpen);
  await page.locator("#teaching-close").click();
  await page.evaluate(() => window.releaseExerciseOpen());
  await page.waitForTimeout(200);
  assert(
    await page.locator("#exercise").isHidden(),
    "Cancelled exercise opened in the background",
  );
  page.off("download", note);
  await page.goto(base);
}
