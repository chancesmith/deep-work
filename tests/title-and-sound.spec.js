import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("page title reflects idle, running, and paused states", async ({ page }) => {
  await expect(page).toHaveTitle("Deep Work");

  await page.locator("#primary").click(); // start
  await expect(page).toHaveTitle(/^\d{2}:\d{2} · Focus$/);

  await page.locator("#primary").click(); // pause
  await expect(page).toHaveTitle(/^\d{2}:\d{2} · Paused$/);
});

test("completion sound toggle defaults on and is independently switchable", async ({ page }) => {
  await page.locator('[data-open="settings"]').first().click();
  const chimeSwitch = page.locator('[data-switch="completionSoundEnabled"]');
  await expect(chimeSwitch).toHaveClass(/is-on/);

  await chimeSwitch.click();
  await expect(chimeSwitch).not.toHaveClass(/is-on/);

  await page.reload();
  await page.locator('[data-open="settings"]').first().click();
  await expect(page.locator('[data-switch="completionSoundEnabled"]')).not.toHaveClass(/is-on/);
});

test("finishing a focus session completes cleanly with completion sound enabled", async ({ page }) => {
  // Headless audio output can't be asserted directly; this verifies the
  // session-complete path (which triggers playChime) runs without error
  // and records history, with completionSoundEnabled left at its default (on).
  await page.evaluate(() => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: {
          theme: "system",
          layout: "big",
          soundEnabled: false,
          soundChoice: "tick",
          completionSoundEnabled: true,
          background: { type: "none", value: "" },
          autoResumeAfterBreak: false,
          defaultPresetMinutes: 25,
        },
        timer: { mode: "focus", remainingSeconds: 25 * 60, running: false, presetMinutes: 25, sessionStartedAt: null },
        history: {},
      })
    );
  });
  await page.reload();

  // simulate a near-complete session so the natural 1s tick finishes it quickly
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("deepwork:state"));
    state.timer.remainingSeconds = 1;
    state.timer.running = true;
    state.timer.sessionStartedAt = Date.now() - state.timer.presetMinutes * 60 * 1000 + 1000;
    localStorage.setItem("deepwork:state", JSON.stringify(state));
  });
  await page.reload();

  await expect(page.locator("#label")).toHaveText("Break", { timeout: 4000 });
  const today = new Date().toISOString().slice(0, 10);
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem("deepwork:state")).history);
  expect(history[today]).toBe(25);
});
