import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function defaceFlow(page, { local, name, width }) {
  const startedAt = performance.now();
  const prefix = `output/nifti-deface/${local ? "local" : "public"}-${name}-${width}`;
  await mkdir("output/nifti-deface", { recursive: true });
  const ready = async () => {
    await page.waitForFunction(() => /could not|unavailable/.test(document.getElementById("status").textContent) || (!document.getElementById("compare-view").disabled && /Comparison ready/.test(document.getElementById("status").textContent)));
    assert.match(await page.locator("#status").textContent(), /Comparison ready/);
    assert(await page.locator("#compare-view").isEnabled());
  };
  await page.locator("#deface-demo").click();
  await ready();
  assert.equal(await page.locator("#plane").inputValue(), "2");
  assert.match(await page.locator("#compare-context").textContent(), /Prepared/);
  if (local) {
    assert(await page.locator("#save-defaced").isDisabled());
    assert(await page.locator("#deface-run").isDisabled());
    await page.locator("#review-mask").check();
    await page.locator("#deface-run").click();
    await page.waitForFunction(() => document.getElementById("deface-status").textContent.startsWith("Saved proposal reopened"));
    await ready();
    assert.match(await page.locator("#compare-context").textContent(), /Computed locally/);
    await page.locator("#inspect-comparison").click();
    assert.equal(await page.evaluate(() => document.activeElement.id), "compare-view");
  } else {
    assert.equal(await page.locator("#deface-review").count(), 0);
    assert.equal(await page.locator("input[type=file]").count(), 0);
  }
  await page.locator("#plane").selectOption("2");
  await page.locator(".pan-controls summary").click();
  for (const plane of ["0", "1", "2"]) {
    await page.locator("#plane").selectOption(plane);
    await page.locator("#zoom").fill("200"); await page.locator("#zoom").dispatchEvent("input");
    const prior = await page.locator("canvas").evaluate(c => c.toDataURL());
    const position = await page.locator("#position").textContent();
    await page.locator("#pan-x").fill("15"); await page.locator("#pan-x").dispatchEvent("input");
    await page.locator("#pan-y").fill("10"); await page.locator("#pan-y").dispatchEvent("input");
    assert.notEqual(await page.locator("canvas").evaluate(c => c.toDataURL()), prior);
    assert.equal(await page.locator("#position").textContent(), position);
    await page.locator("#fit").click();
    assert.equal(await page.locator("#pan-x").inputValue(), "0");
    assert.equal(await page.locator("#pan-y").inputValue(), "0");
  }
  await page.locator("#pan-x").fill("5"); await page.locator("#pan-x").dispatchEvent("input");
  await page.locator("#pan-y").fill("3"); await page.locator("#pan-y").dispatchEvent("input");
  await page.locator("#slice").fill("48");
  await page.locator("#slice").dispatchEvent("input");
  await page.locator("#contrast").fill("125");
  await page.locator("#contrast").dispatchEvent("input");
  const axes = await page.locator("#position").textContent();
  const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
  await page.evaluate(axe);
  const pictures = {};
  for (const key of ["before", "after", "removal", "brain", "after"]) {
    await page.locator("#compare-view").selectOption(key);
    await ready();
    assert.equal(await page.locator("#position").textContent(), axes);
    if (["before", "after"].includes(key)) assert.equal(await page.locator("#contrast").inputValue(), "125");
    assert.equal(await page.locator("#plane").inputValue(), "2");
    assert.equal(await page.locator("#pan-x").inputValue(), "5");
    assert.equal(await page.locator("#pan-y").inputValue(), "3");
    const picture = await page.locator("canvas").evaluate(c => c.toDataURL());
    pictures[key] = picture;
    if (name === "chromium" && [1280, 320].includes(width)) {
      await writeFile(`${prefix}-${key}-pixels.png`, Buffer.from(picture.split(",")[1], "base64"));
    }
    const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
    assert.deepEqual(violations, [], `${prefix} ${key}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${prefix} horizontal overflow`);
  }
  assert.notEqual(pictures.before, pictures.after, "Central sagittal image must visibly change");
  assert.notEqual(pictures.brain, pictures.removal, "Brain and removal maps are distinct");
  if (name === "chromium" && [1280, 320].includes(width)) {
    await page.locator("#comparison").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${prefix}-comparison.png`, fullPage: true });
    await page.screenshot({ path: `${prefix}-viewport.png` });
  }
  if (local) {
    assert(await page.locator("#save-defaced").isDisabled());
    await page.locator("#review-deface").check();
    for (const [button, suffix] of [["save-defaced", "nii"], ["save-removal", "mask.nii"], ["save-deface-report", "json"]]) {
      console.log("Download removal", name, width, button);
      assert(await page.locator("#" + button).isEnabled(), button);
      const pending = page.waitForEvent("download");
      await page.locator("#" + button).click();
      await (await pending).saveAs(`${prefix}.${suffix}`);
    }
    const report = JSON.parse(await readFile(`${prefix}.json`, "utf8"));
    const hash = bytes => createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash(await readFile(`${prefix}.nii`)), report.output_sha256);
    assert.equal(hash(await readFile(`${prefix}.mask.nii`)), report.removal_mask_sha256);
    await page.locator("#compare-view").selectOption("before"); await ready();
    assert(await page.locator("#save-defaced").isDisabled());
    await page.locator("#margin").fill("10");
    assert(await page.locator("#save-defaced").isDisabled());
    assert(await page.locator("#comparison").isHidden());
    assert(!await page.locator("#review-deface").isChecked());
  }
  await page.locator("#clear").click();
  assert(await page.locator("#volume-work").isHidden());
  if (local) {
    assert(await page.locator("#deface-run").isDisabled());
    assert(await page.locator("#save-defaced").isDisabled());
  }
  console.log("Defacing comparison passed", local ? "local" : "public", name, width);
  if (local && name === "chromium" && width === 1280) {
    await page.locator("#deface-demo").click(); await ready();
    await page.locator("#brain-mask").setInputFiles("src/dicom_workbench/web/nifti-assets/phantom.nii.gz");
    await page.waitForFunction(() => document.getElementById("mask-status").textContent.startsWith("Mask file loaded"));
    await page.locator("#review-mask").check();
    await page.locator("#deface-run").click();
    await page.waitForFunction(() => /dimensions and coordinate grid/.test(document.getElementById("deface-status").textContent));
    assert(await page.locator("#save-defaced").isDisabled());
    await page.locator("#deface-demo").click(); await ready();
    await page.route("**/api/nifti/deface", async route => {
      const response = await route.fetch();
      const bytes = Buffer.from(await response.body());
      bytes[bytes.length - 1] ^= 1;
      await route.fulfill({ response, body: bytes });
    });
    await page.locator("#review-mask").check();
    await page.locator("#deface-run").click();
    await page.waitForFunction(() => /returned files did not match/.test(document.getElementById("deface-status").textContent));
    assert(await page.locator("#save-defaced").isDisabled());
    await page.unroute("**/api/nifti/deface");
    let started, release, finished;
    const hasStarted = new Promise(resolve => { started = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    const hasFinished = new Promise(resolve => { finished = resolve; });
    await page.route("**/api/nifti/deface", async route => {
      try {
        const response = await route.fetch();
        started(); await gate;
        await route.fulfill({ response });
      } catch { /* Browser abort is expected. */ }
      finally { finished(); }
    });
    await page.locator("#deface-run").click();
    await hasStarted;
    await page.locator("#clear").click();
    release(); await hasFinished;
    await page.unroute("**/api/nifti/deface");
    await page.locator("#phantom").click();
    await page.waitForFunction(() => !document.getElementById("clean").disabled);
    assert(await page.locator("#save-defaced").isDisabled());
    assert(await page.locator("#comparison").isHidden());
    await page.locator("#clear").click();
    console.log("Mask mismatch, altered response and cancelled removal blocked");
  }
  await writeFile(`${prefix}-checks.json`, JSON.stringify({
    local, browser: name, width, distinct_comparison_views: 4,
    linked_slice_zoom_pan_and_anatomy_contrast: true, pan_all_three_planes: true,
    accessibility_violations: [], horizontal_overflow: false,
    reviewed_downloads_verified: local,
    adversarial_response_and_cancellation_checks: local && name === "chromium" && width === 1280,
    browser_workflow_duration_ms: Math.round(performance.now() - startedAt),
    scope: "Software checks on one prepared average-head template; not clinical or privacy accuracy."
  }, null, 2) + "\n");
}
