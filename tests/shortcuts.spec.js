import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("space toggles start/pause", async ({ page }) => {
  await expect(page.locator("#primary")).toHaveText("Start");
  await page.keyboard.press("Space");
  await expect(page.locator("#primary")).toHaveText("Pause");
  await page.keyboard.press("Space");
  await expect(page.locator("#primary")).toHaveText("Resume");
});

test("r resets the timer", async ({ page }) => {
  await page.locator('.chip[data-minutes="25"]').click();
  await page.keyboard.press("Space");
  await page.waitForTimeout(1300);
  await page.keyboard.press("r");
  await expect(page.locator("#label")).toHaveText("Ready");
  await expect(page.locator("#digits")).toHaveText("25:00");
});

test("s toggles the settings sheet", async ({ page }) => {
  await page.keyboard.press("s");
  await expect(page.locator('[data-sheet="settings"]')).toHaveClass(/is-open/);
  await page.keyboard.press("s");
  await expect(page.locator('[data-sheet="settings"]')).not.toHaveClass(/is-open/);
});

test("y toggles the year progress sheet", async ({ page }) => {
  await page.keyboard.press("y");
  await expect(page.locator('[data-sheet="progress"]')).toHaveClass(/is-open/);
  await page.keyboard.press("y");
  await expect(page.locator('[data-sheet="progress"]')).not.toHaveClass(/is-open/);
});

test("shortcuts are ignored while typing in the background URL field", async ({ page }) => {
  await page.keyboard.press("s"); // open settings
  await page.locator('[data-seg="background-type"] [data-value="image"]').click();
  await page.locator("#bg-url").focus();
  await page.keyboard.type("https://example.com/space.jpg");
  await expect(page.locator("#primary")).toHaveText("Start"); // space keystrokes didn't start the timer
});

test("l cycles through layouts big -> small -> corner -> big", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-layout", "big");
  await page.keyboard.press("l");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "small");
  await page.keyboard.press("l");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "corner");
  await page.keyboard.press("l");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "big");
});

test("l keeps the settings layout picker in sync when open", async ({ page }) => {
  await page.keyboard.press("s");
  await page.keyboard.press("l");
  await expect(page.locator('[data-seg="layout"] [data-value="small"]')).toHaveClass(/is-on/);
});
