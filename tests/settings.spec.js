import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("reset to defaults reverts changed settings", async ({ page }) => {
  await page.locator('[data-open="settings"]').first().click();

  await page.locator('[data-seg="theme"] [data-value="dark"]').click();
  await page.locator('[data-seg="layout"] [data-value="small"]').click();
  await page.locator('[data-switch="soundEnabled"]').click();
  await page.locator('[data-switch="autoResumeAfterBreak"]').click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-layout", "small");

  await page.locator("#reset-defaults").click();

  await expect(page.locator("html")).toHaveAttribute("data-layout", "big");
  await expect(page.locator('[data-seg="theme"] [data-value="system"]')).toHaveClass(/is-on/);
  await expect(page.locator('[data-switch="soundEnabled"]')).not.toHaveClass(/is-on/);
  await expect(page.locator('[data-switch="autoResumeAfterBreak"]')).toHaveClass(/is-on/);
  await expect(page.locator("#digits")).toHaveText("45:00");
});

test("reset to defaults does not erase focus history", async ({ page }) => {
  await page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: {
          theme: "system",
          layout: "big",
          soundEnabled: false,
          soundChoice: "tick",
          background: { type: "none", value: "" },
          autoResumeAfterBreak: true,
          defaultPresetMinutes: 45,
        },
        timer: { mode: "focus", remainingSeconds: 45 * 60, running: false, presetMinutes: 45, sessionStartedAt: null },
        history: { [today]: 30 },
      })
    );
  });
  await page.reload();
  await expect(page.locator("#stat-today")).toHaveText("30");

  await page.locator('[data-open="settings"]').first().click();
  await page.locator("#reset-defaults").click();

  await expect(page.locator("#stat-today")).toHaveText("30");
});
