import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

function secondsFromDigits(text) {
  const [m, s] = text.split(":").map(Number);
  return m * 60 + s;
}

test("countdown decrements by exactly one second per tick after a reload mid-session", async ({ page }) => {
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
          autoResumeAfterBreak: true,
          defaultPresetMinutes: 45,
        },
        timer: {
          mode: "focus",
          remainingSeconds: 40 * 60,
          running: true,
          presetMinutes: 45,
          sessionStartedAt: Date.now() - 5 * 60 * 1000,
        },
        history: {},
      })
    );
  });
  await page.reload();

  const seen = [];
  const start = Date.now();
  let last = null;
  while (Date.now() - start < 4500) {
    const text = await page.locator("#digits").textContent();
    const value = secondsFromDigits(text);
    if (value !== last) {
      seen.push(value);
      last = value;
    }
    await page.waitForTimeout(50);
  }

  // every observed change must be a drop of exactly 1 second — a drop of 2
  // means two ticks fired for the same real-world second (the reported bug)
  for (let i = 1; i < seen.length; i++) {
    expect(seen[i - 1] - seen[i]).toBe(1);
  }
  expect(seen.length).toBeGreaterThanOrEqual(3);
});

test("ticking sound plays at most once per real second even under duplicate tick pressure", async ({ page }) => {
  await page.addInitScript(() => {
    window.__starts = [];
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__starts.push(performance.now());
      return orig.apply(this, args);
    };
  });

  await page.evaluate(() => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: {
          theme: "system",
          layout: "big",
          soundEnabled: true,
          soundChoice: "tick",
          completionSoundEnabled: true,
          background: { type: "none", value: "" },
          autoResumeAfterBreak: true,
          defaultPresetMinutes: 45,
        },
        timer: {
          mode: "focus",
          remainingSeconds: 40 * 60,
          running: true,
          presetMinutes: 45,
          sessionStartedAt: Date.now() - 5 * 60 * 1000,
        },
        history: {},
      })
    );
  });
  await page.reload();
  await page.mouse.move(50, 50);
  await page.mouse.down();
  await page.mouse.up();

  await page.waitForTimeout(4200);
  const starts = await page.evaluate(() => window.__starts);

  // roughly one play per elapsed second (~4), never doubled
  expect(starts.length).toBeGreaterThanOrEqual(2);
  expect(starts.length).toBeLessThanOrEqual(5);
  for (let i = 1; i < starts.length; i++) {
    expect(starts[i] - starts[i - 1]).toBeGreaterThan(500);
  }
});
