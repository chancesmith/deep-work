import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-open="settings"]').first().click();
});

const settings = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("deepwork:state")).settings);

test("colour and image URL are stored separately and survive switching type", async ({ page }) => {
  await page.locator('[data-seg="background-type"] [data-value="image"]').click();
  await page.locator("#bg-url").fill("https://example.com/photo.jpg");
  await page.locator("#bg-url").dispatchEvent("change");

  await page.locator('[data-seg="background-type"] [data-value="color"]').click();
  await page.locator("#bg-color").evaluate((input) => {
    input.value = "#123456";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // switching type must not clobber the other field
  let s = await settings(page);
  expect(s.backgroundType).toBe("color");
  expect(s.backgroundColor).toBe("#123456");
  expect(s.backgroundImageUrl).toBe("https://example.com/photo.jpg");

  // and both values come back when revisiting each type
  await page.locator('[data-seg="background-type"] [data-value="image"]').click();
  await expect(page.locator("#bg-url")).toHaveValue("https://example.com/photo.jpg");
  await page.locator('[data-seg="background-type"] [data-value="color"]').click();
  await expect(page.locator("#bg-color")).toHaveValue("#123456");

  await page.reload();
  s = await settings(page);
  expect(s.backgroundColor).toBe("#123456");
  expect(s.backgroundImageUrl).toBe("https://example.com/photo.jpg");
});

test("only the control for the selected background type is shown", async ({ page }) => {
  await expect(page.locator('[data-bg-control="color"]')).toBeHidden();
  await expect(page.locator('[data-bg-control="image"]')).toBeHidden();

  await page.locator('[data-seg="background-type"] [data-value="color"]').click();
  await expect(page.locator('[data-bg-control="color"]')).toBeVisible();
  await expect(page.locator('[data-bg-control="image"]')).toBeHidden();

  await page.locator('[data-seg="background-type"] [data-value="image"]').click();
  await expect(page.locator('[data-bg-control="image"]')).toBeVisible();
  await expect(page.locator('[data-bg-control="color"]')).toBeHidden();
});

test("the chosen colour is actually painted (it used to be hardcoded in CSS)", async ({ page }) => {
  await page.locator('[data-seg="background-type"] [data-value="color"]').click();
  await page.locator("#bg-color").evaluate((input) => {
    input.value = "#ff0000";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const painted = await page.locator(".bg").evaluate((n) => getComputedStyle(n).backgroundColor);
  expect(painted).toBe("rgb(255, 0, 0)");
});

test("a non-http image URL is rejected rather than injected into the CSS value", async ({ page }) => {
  await page.locator('[data-seg="background-type"] [data-value="image"]').click();
  await page.locator("#bg-url").fill('javascript:alert(1)');
  await page.locator("#bg-url").dispatchEvent("change");

  const image = await page.locator(".bg").evaluate((n) => n.style.backgroundImage);
  expect(image).toBe("");
});

test("legacy { type, value } background state migrates to the split fields", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: { background: { type: "image", value: "https://example.com/old.jpg" } },
        timer: {},
        history: {},
      })
    );
  });
  await page.reload();

  // the migration happens on read, so assert the state the app actually sees
  // (it gets written back to storage on the next save, not eagerly on load)
  const s = await page.evaluate(async () => {
    const { store } = await import("/js/store.js");
    return store.get().settings;
  });
  expect(s.backgroundType).toBe("image");
  expect(s.backgroundImageUrl).toBe("https://example.com/old.jpg");
  expect(s.background).toBeUndefined();
  expect(s.backgroundColor).toBeTruthy(); // falls back to the default colour

  // and it's applied to the page, not just parsed
  await expect(page.locator("html")).toHaveAttribute("data-bg", "image");
  await expect(page.locator("#bg-url")).toHaveValue("https://example.com/old.jpg");
});

test("preset swatches set the colour without the native dialog", async ({ page }) => {
  await page.locator('[data-seg="background-type"] [data-value="color"]').click();
  await page.locator('.swatch[data-color="#D7E3DA"]').click();

  await expect(page.locator('.swatch[data-color="#D7E3DA"]')).toHaveClass(/is-on/);
  await expect(page.locator("#bg-color")).toHaveValue("#d7e3da");
  expect((await settings(page)).backgroundColor).toBe("#D7E3DA");

  const painted = await page.locator(".bg").evaluate((n) => getComputedStyle(n).backgroundColor);
  expect(painted).toBe("rgb(215, 227, 218)");

  // and it survives a refresh, with the swatch still marked
  await page.reload();
  expect((await settings(page)).backgroundType).toBe("color");
  await page.locator('[data-open="settings"]').first().click();
  await expect(page.locator('.swatch[data-color="#D7E3DA"]')).toHaveClass(/is-on/);
});

test("Escape in the colour input is left to the native dialog, not the sheet", async ({ page }) => {
  await page.locator('[data-seg="background-type"] [data-value="color"]').click();
  await page.locator("#bg-color").focus();
  await page.keyboard.press("Escape");

  // the sheet stays open — Escape there belongs to the colour dialog
  await expect(page.locator('[data-sheet="settings"]')).toHaveClass(/is-open/);

  // but Escape anywhere else still closes it
  await page.locator("#swatches").click({ position: { x: 1, y: 1 } });
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-sheet="settings"]')).not.toHaveClass(/is-open/);
});

test("a garbage backgroundType falls back instead of blanking the picker", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: { backgroundType: "bogus", backgroundColor: "not-a-colour" },
        timer: {},
        history: {},
      })
    );
  });
  await page.reload();

  // the type picker must always have exactly one option selected
  await page.locator('[data-open="settings"]').first().click();
  await expect(page.locator('[data-seg="background-type"] .seg__opt.is-on')).toHaveCount(1);
  await expect(page.locator('[data-seg="background-type"] [data-value="none"]')).toHaveClass(/is-on/);
  await expect(page.locator("html")).toHaveAttribute("data-bg", "none");
  await expect(page.locator("#bg-color")).toHaveValue("#dcd9ce");
});
