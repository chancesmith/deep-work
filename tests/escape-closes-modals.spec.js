import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

for (const sheet of ["settings", "progress"]) {
  test(`Escape closes the ${sheet} modal`, async ({ page }) => {
    await page.locator(`[data-open="${sheet}"]`).first().click();
    await expect(page.locator(`[data-sheet="${sheet}"]`)).toHaveClass(/is-open/);

    await page.keyboard.press("Escape");
    await expect(page.locator(`[data-sheet="${sheet}"]`)).not.toHaveClass(/is-open/);
  });
}

test("Escape still closes the modal while typing in the URL field", async ({ page }) => {
  await page.locator('[data-open="settings"]').first().click();
  await page.locator('[data-seg="background-type"] [data-value="image"]').click();
  await page.locator("#bg-url").focus();
  await page.keyboard.type("https://example.com/x.jpg");

  await page.keyboard.press("Escape");
  await expect(page.locator('[data-sheet="settings"]')).not.toHaveClass(/is-open/);
});
