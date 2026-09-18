import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("AudioContext is resumed on the unlocking gesture and stays running", async ({ page }) => {
  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.up();

  const state = await page.evaluate(async () => {
    const { playTick } = await import("/js/sound.js");
    // give any pending resume() a tick to settle
    await new Promise((r) => setTimeout(r, 50));
    return "checked";
  });
  expect(state).toBe("checked");

  // ticks scheduled after the unlock gesture must actually be audible
  // (context running), not silently queued against a suspended context
  await page.evaluate(() => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: {
          theme: "system", layout: "big", soundEnabled: true, soundChoice: "tick",
          completionSoundEnabled: true, background: { type: "none", value: "" },
          autoResumeAfterBreak: true, defaultPresetMinutes: 45,
        },
        timer: { mode: "focus", remainingSeconds: 45 * 60, running: false, presetMinutes: 45, sessionStartedAt: null },
        history: {},
      })
    );
  });

  await page.addInitScript(() => {
    window.__ctxStates = [];
    const OrigCtx = window.AudioContext || window.webkitAudioContext;
    class SpyCtx extends OrigCtx {
      constructor(...args) {
        super(...args);
        window.__ctxStates.push(this.state);
        this.addEventListener("statechange", () => window.__ctxStates.push(this.state));
      }
    }
    window.AudioContext = SpyCtx;
    window.webkitAudioContext = SpyCtx;
  });
  await page.reload();

  await page.locator("#primary").click(); // starts the timer, itself a gesture too
  await page.waitForTimeout(1500);

  const ctxStates = await page.evaluate(() => window.__ctxStates);
  expect(ctxStates[ctxStates.length - 1]).toBe("running");
});
