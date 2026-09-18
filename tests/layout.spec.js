import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function switchLayout(page, value) {
  await page.locator('[data-open="settings"]').first().click();
  await page.locator(`[data-seg="layout"] [data-value="${value}"]`).click();
  await page.locator("[data-sheet='settings'] [data-close]").click();
}

test("corner layout still exposes a way back to other layouts", async ({ page }) => {
  await switchLayout(page, "corner");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "corner");

  // regression: corner previously hid the header, leaving no UI to change layout
  await expect(page.locator("#widget-settings")).toBeVisible();
  await page.locator("#widget-settings").click();
  await expect(page.locator('[data-sheet="settings"]')).toHaveClass(/is-open/);

  await page.locator('[data-seg="layout"] [data-value="big"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "big");
});

test("corner widget play/pause icon reflects running state", async ({ page }) => {
  await switchLayout(page, "corner");
  const toggle = page.locator("#widget-toggle");

  // idle: play icon shown, pause icon hidden
  await expect(toggle.locator(".icon-play")).toBeVisible();
  await expect(toggle.locator(".icon-pause")).toBeHidden();

  await toggle.click(); // start
  await expect(toggle.locator(".icon-pause")).toBeVisible();
  await expect(toggle.locator(".icon-play")).toBeHidden();

  await toggle.click(); // pause
  await expect(toggle.locator(".icon-play")).toBeVisible();
  await expect(toggle.locator(".icon-pause")).toBeHidden();
});

test("layout choice persists across reload", async ({ page }) => {
  await switchLayout(page, "small");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "small");
});
