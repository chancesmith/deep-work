import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("two near-simultaneous tick triggers before the buffer is cached only play once", async ({ page }) => {
  // Reproduces the reported bug: pressing pause/play fast fires two ticks
  // before the first fetch+decode of tick.mp3 resolves, which previously
  // caused both to independently decode and play, sounding doubled.
  await page.evaluate(async () => {
    window.__starts = 0;
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__starts++;
      return orig.apply(this, args);
    };
  });

  // unlock the AudioContext the same way a real user interaction would
  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.up();

  await page.evaluate(async () => {
    const { playTick } = await import("/js/sound.js");
    const state = JSON.parse(localStorage.getItem("deepwork:state")) || {};
    state.settings = { ...state.settings, soundEnabled: true, soundChoice: "tick" };
    localStorage.setItem("deepwork:state", JSON.stringify(state));

    // fire twice back-to-back, before the first fetch+decode can resolve
    playTick();
    playTick();
  });

  await page.waitForTimeout(500);
  const starts = await page.evaluate(() => window.__starts);
  expect(starts).toBe(1);
});

test("ticks a reasonable time apart both play", async ({ page }) => {
  await page.evaluate(async () => {
    window.__starts = 0;
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__starts++;
      return orig.apply(this, args);
    };
  });

  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.up();

  await page.evaluate(async () => {
    const { playTick } = await import("/js/sound.js");
    const state = JSON.parse(localStorage.getItem("deepwork:state")) || {};
    state.settings = { ...state.settings, soundEnabled: true, soundChoice: "tick" };
    localStorage.setItem("deepwork:state", JSON.stringify(state));
    playTick();
  });
  await page.waitForTimeout(500);

  await page.evaluate(async () => {
    const { playTick } = await import("/js/sound.js");
    playTick();
  });
  await page.waitForTimeout(500);

  const starts = await page.evaluate(() => window.__starts);
  expect(starts).toBe(2);
});
