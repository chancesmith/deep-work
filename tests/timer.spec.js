import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("idle state shows Start and default 45m preset", async ({ page }) => {
  await expect(page.locator("#label")).toHaveText("Ready");
  await expect(page.locator("#digits")).toHaveText("45:00");
  await expect(page.locator("#primary")).toHaveText("Start");
  await expect(page.locator('.chip[data-minutes="45"]')).toHaveClass(/is-on/);
});

test("selecting a preset updates the idle countdown", async ({ page }) => {
  await page.locator('.chip[data-minutes="25"]').click();
  await expect(page.locator("#digits")).toHaveText("25:00");
  await expect(page.locator('.chip[data-minutes="25"]')).toHaveClass(/is-on/);
});

test("start begins a focus session and counts down", async ({ page }) => {
  await page.locator("#primary").click();
  await expect(page.locator("#label")).toHaveText("Focus");
  await expect(page.locator("#primary")).toHaveText("Pause");
  await page.waitForTimeout(1300);
  await expect(page.locator("#digits")).not.toHaveText("45:00");
});

test("pause and resume toggle without losing time", async ({ page }) => {
  await page.locator("#primary").click();
  await page.waitForTimeout(1300);
  await page.locator("#primary").click();
  await expect(page.locator("#primary")).toHaveText("Resume");
  const paused = await page.locator("#digits").textContent();
  await page.waitForTimeout(1200);
  await expect(page.locator("#digits")).toHaveText(paused);
  await page.locator("#primary").click();
  await expect(page.locator("#primary")).toHaveText("Pause");
});

test("reset returns to idle at the selected preset", async ({ page }) => {
  await page.locator('.chip[data-minutes="25"]').click();
  await page.locator("#primary").click();
  await page.waitForTimeout(1300);
  await page.locator("#reset-btn").click();
  await expect(page.locator("#label")).toHaveText("Ready");
  await expect(page.locator("#digits")).toHaveText("25:00");
  await expect(page.locator("#primary")).toHaveText("Start");
});
