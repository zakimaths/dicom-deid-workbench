import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const items = JSON.parse(
  await readFile(
    new URL(
      "../src/dicom_workbench/web/teaching/catalog.json",
      import.meta.url,
    ),
  ),
);

export async function checkTeaching(
  page,
  base,
  engineName,
  screenshots = false,
) {
  await page.goto(base);
  // Closing during the first catalogue request must not reopen or select behind the dialog.
  const catalogURL = new URL("teaching/catalog.json", base).href;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(catalogURL, async (route) => {
    await gate;
    await route.continue();
  });
  const pending = page.waitForRequest(catalogURL);
  await page.locator("#browse-teaching").click();
  await pending;
  await page.locator("#teaching-close").click();
  const response = page.waitForResponse(catalogURL);
  release();
  await response;
  await page.waitForTimeout(100);
  assert(!(await page.locator("#teaching-dialog").evaluate((el) => el.open)));
  assert.equal(new URL(page.url()).hash, "");
  assert(await page.locator("#teaching-image").isHidden());
  await page.unroute(catalogURL);
  await page.locator("#browse-teaching").click();
  const ready = async () => {
    try {
      await page.waitForFunction(
        () =>
          document.querySelector(".teaching-view").getAttribute("aria-busy") ===
            "false" && !document.querySelector("#teaching-image").hidden,
      );
    } catch (cause) {
      throw new Error(
        JSON.stringify(
          await page.evaluate(() => ({
            title: document.querySelector("#teaching-title").textContent,
            status: document.querySelector("#teaching-status").textContent,
            busy: document
              .querySelector(".teaching-view")
              .getAttribute("aria-busy"),
            open: document.querySelector("#teaching-dialog").open,
            hash: location.hash,
          })),
        ),
        { cause },
      );
    }
  };
  await ready();
  assert.equal(await page.locator(".teaching-card").count(), 50);
  for (const item of items) {
    await page.locator(`#teaching-card-${item.id}`).click();
    await ready();
    assert(
      await page.evaluate(() => {
        const picture = document
          .querySelector("#teaching-image")
          .getBoundingClientRect();
        const stage = document
          .querySelector("#teaching-stage")
          .getBoundingClientRect();
        return (
          picture.width <= stage.width + 1 && picture.height <= stage.height + 1
        );
      }),
      `Fitted image is cropped: ${item.id}`,
    );
    assert.equal(
      await page.locator("#teaching-title").textContent(),
      item.title,
    );
    assert.equal(
      await page.locator("#teaching-look").textContent(),
      item.look_for,
    );
    assert.equal(
      await page.locator("#teaching-source").getAttribute("href"),
      item.source_url,
    );
    assert.deepEqual(
      await page
        .locator("#teaching-image")
        .evaluate((img) => [img.naturalWidth, img.naturalHeight]),
      [item.width, item.height],
    );
    assert.equal(
      await page.locator("#teaching-brightness").inputValue(),
      "100",
    );
    assert.equal(await page.locator("#teaching-contrast").inputValue(), "100");
  }
  for (const [type, count] of [
    ["MRI", 15],
    ["CT", 15],
    ["X-ray", 20],
  ]) {
    await page.locator("#teaching-filter").selectOption(type);
    assert.equal(await page.locator(".teaching-card").count(), count);
  }
  await page.locator("#teaching-search").fill("no-such-anatomy");
  assert.equal(await page.locator(".teaching-card").count(), 0);
  assert.match(
    await page.locator("#teaching-count").textContent(),
    /No matches/,
  );
  assert(await page.locator("#teaching-next").isDisabled());
  await page.locator("#teaching-filter").selectOption("MRI");
  await page.locator("#teaching-search").fill("knee");
  assert.equal(await page.locator(".teaching-card").count(), 2);
  await page.locator(".teaching-card").first().click();
  await ready();
  await page.locator("#teaching-next").click();
  await ready();
  assert(await page.locator("#teaching-next").isDisabled());
  await page.locator("#teaching-prev").click();
  await ready();
  assert(await page.locator("#teaching-prev").isDisabled());
  await page.locator("#teaching-zoom").click();
  assert(
    await page
      .locator("#teaching-stage")
      .evaluate((el) => el.classList.contains("actual-size")),
  );
  await page.locator("#teaching-brightness").fill("140");
  assert.match(
    await page.locator("#teaching-image").evaluate((el) => el.style.filter),
    /140%/,
  );
  await page.locator("#teaching-reset").click();
  assert.equal(await page.locator("#teaching-brightness").inputValue(), "100");
  assert.equal(
    await page.locator("#teaching-image").evaluate((el) => el.style.filter),
    "none",
  );
  assert(
    !(await page
      .locator("#teaching-stage")
      .evaluate((el) => el.classList.contains("actual-size"))),
  );
  await page.mouse.move(0, 0);
  await page.locator("#teaching-reset").focus();
  assert.match(await page.locator("#teaching-help").textContent(), /publisher/);
  const deepLink = page.url();
  // Close and immediately navigate in the same task: late native close events
  // must not strip the new link or cancel the reopened library.
  await page.evaluate((url) => {
    document.getElementById("teaching-close").click();
    location.hash = new URL(url).hash;
  }, deepLink);
  await ready();
  assert.equal(new URL(page.url()).hash, new URL(deepLink).hash);
  await page.keyboard.press("Escape");
  assert(!(await page.locator("#teaching-dialog").evaluate((el) => el.open)));
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "browse-teaching",
  );
  await page.goto(deepLink);
  await page.reload();
  await ready();
  assert.match(await page.locator("#teaching-title").textContent(), /Knee/);
  // A corrupt image must hide the previous picture, not mislabel stale pixels.
  const corruptURL = new URL("teaching/" + items[0].file, base).href;
  await page.route(corruptURL, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: "invalid bytes",
    }),
  );
  await page.locator(`#teaching-card-${items[0].id}`).click();
  await page.waitForFunction(() =>
    document.querySelector("#teaching-status").textContent.includes("failed"),
  );
  assert(await page.locator("#teaching-image").isHidden());
  assert(await page.locator("#teaching-zoom").isDisabled());
  await page.unroute(corruptURL);
  await page.locator(`#teaching-card-${items[0].id}`).click();
  await ready();
  // Late results cannot replace a more recently selected picture.
  await page.route(corruptURL, async (route) => {
    await new Promise((r) => setTimeout(r, 200));
    await route.continue().catch(() => {});
  });
  await page.locator(`#teaching-card-${items[0].id}`).click();
  await page.locator(`#teaching-card-${items[1].id}`).click();
  await ready();
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator("#teaching-title").textContent(),
    items[1].title,
  );
  assert.equal(
    await page.locator("#teaching-image").getAttribute("alt"),
    `${items[1].modality}: ${items[1].title}. ${items[1].view}.`,
  );
  await page.unroute(corruptURL);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedTeachingLink = text;
        },
      },
    }),
  );
  await page.locator("#teaching-share").click();
  assert.match(
    await page.evaluate(() => window.copiedTeachingLink),
    /^https:\/\/zakimaths\.github\.io\/dicom-deid-workbench\/#learn=/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#teaching-find").click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "teaching-search",
  );
  await page.locator(".teaching-card").last().click();
  await ready();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "teaching-title",
  );
  assert(
    await page.locator("#teaching-title").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom < innerHeight;
    }),
  );
  if (screenshots && engineName === "chromium") {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator(`#teaching-card-${items[6].id}`).click();
    await ready();
    await page.locator("#teaching-dialog").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: `output/teaching-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#teaching-dialog").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: `output/teaching-mobile.png` });
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(
      await page
        .locator("#teaching-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `Teaching dialog overflow at ${width}`,
    );
  }
  await page.locator("#teaching-close").click();
  await page.setViewportSize({ width: 1440, height: 1100 });
  console.log(
    `${engineName}: all 50 teaching images, labels, filters, links, controls, corruption/race handling and responsive layout passed`,
  );
}
