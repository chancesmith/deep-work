import { test, expect } from "@playwright/test";

const RUNNING_STATE = {
  settings: {
    theme: "system", layout: "big", soundEnabled: true, soundChoice: "tick",
    completionSoundEnabled: true, background: { type: "none", value: "" },
    autoResumeAfterBreak: true, defaultPresetMinutes: 45,
  },
  timer: { mode: "focus", remainingSeconds: 40 * 60, running: true, presetMinutes: 45, sessionStartedAt: 0 },
  history: {},
};

async function bootRunningTimerWithSound(page) {
  // record which displayed second each tick sound fired for
  await page.addInitScript(() => {
    window.__plays = [];
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const digits = document.querySelector("#digits");
      window.__plays.push(digits ? digits.textContent : "?");
      return orig.apply(this, args);
    };
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((base) => {
    const state = structuredClone(base);
    state.timer.sessionStartedAt = Date.now() - 5 * 60 * 1000;
    localStorage.setItem("deepwork:state", JSON.stringify(state));
  }, RUNNING_STATE);
  await page.reload();

  // unlock audio with a real gesture
  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.up();
}

function secondsThatSoundedTwice(plays) {
  const counts = {};
  plays.forEach((d) => (counts[d] = (counts[d] || 0) + 1));
  return Object.entries(counts).filter(([, n]) => n > 1);
}

test("resuming does not replay the tick for the second that already sounded", async ({ page }) => {
  await bootRunningTimerWithSound(page);
  await page.waitForTimeout(2200);

  await page.locator("#primary").click(); // pause
  await page.waitForTimeout(500);
  await page.locator("#primary").click(); // resume
  await page.waitForTimeout(3200);

  const plays = await page.evaluate(() => window.__plays);
  expect(plays.length).toBeGreaterThanOrEqual(3); // it really was ticking
  expect(secondsThatSoundedTwice(plays)).toEqual([]);
});

test("repeated pause/resume never doubles a tick", async ({ page }) => {
  await bootRunningTimerWithSound(page);
  await page.waitForTimeout(1200);

  for (let i = 0; i < 2; i++) {
    await page.locator("#primary").click(); // pause
    await page.waitForTimeout(300);
    await page.locator("#primary").click(); // resume
    await page.waitForTimeout(1400);
  }

  const plays = await page.evaluate(() => window.__plays);
  expect(secondsThatSoundedTwice(plays)).toEqual([]);
});
