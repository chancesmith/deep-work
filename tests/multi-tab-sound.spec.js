import { test, expect } from "@playwright/test";

// these spin up several real tabs each and assert on timing-sensitive audio
// cadence, so they don't share a worker with each other
test.describe.configure({ mode: "serial" });

const RUNNING_WITH_SOUND = {
  settings: {
    theme: "system", layout: "big", soundEnabled: true, soundChoice: "tick",
    completionSoundEnabled: false, backgroundType: "none", backgroundColor: "#DCD9CE",
    backgroundImageUrl: "", autoResumeAfterBreak: true, defaultPresetMinutes: 45,
  },
  timer: { mode: "focus", remainingSeconds: 40 * 60, running: true, presetMinutes: 45, sessionStartedAt: 0 },
  history: {},
};

async function countingPage(context) {
  const page = await context.newPage();
  await page.goto("/");
  return page;
}

async function unlockAudio(page) {
  await page.mouse.move(40, 40);
  await page.mouse.down();
  await page.mouse.up();
}

const plays = (page) => page.evaluate(() => window.__plays);

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    window.__plays = 0;
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__plays++;
      return orig.apply(this, args);
    };
  });
});

test("only one tab makes noise when several are open", async ({ context }) => {
  const first = await countingPage(context);
  await first.evaluate((seed) => {
    seed.timer.sessionStartedAt = Date.now() - 5 * 60 * 1000;
    localStorage.setItem("deepwork:state", JSON.stringify(seed));
  }, RUNNING_WITH_SOUND);
  await first.reload();
  await unlockAudio(first);

  const second = await countingPage(context);
  const third = await countingPage(context);
  await unlockAudio(second);
  await unlockAudio(third);

  await first.waitForTimeout(4000);

  const counts = [await plays(first), await plays(second), await plays(third)];
  const total = counts.reduce((a, c) => a + c, 0);

  // ~1 tick/sec in total, not one per tab per second
  expect(total).toBeGreaterThanOrEqual(2);
  expect(total).toBeLessThanOrEqual(6);
  expect(counts.filter((c) => c > 0)).toHaveLength(1);
});

test("enabling the ticking toggle in one tab doesn't start a second tab ticking too", async ({ context }) => {
  const silent = { ...RUNNING_WITH_SOUND, settings: { ...RUNNING_WITH_SOUND.settings, soundEnabled: false } };

  const first = await countingPage(context);
  await first.evaluate((seed) => {
    seed.timer.sessionStartedAt = Date.now() - 5 * 60 * 1000;
    localStorage.setItem("deepwork:state", JSON.stringify(seed));
  }, silent);
  await first.reload();
  await unlockAudio(first);

  const second = await countingPage(context);
  await unlockAudio(second);

  // flip the toggle in the first tab — it lands in shared storage, so the
  // second tab sees soundEnabled too and used to start ticking alongside it
  await first.locator('[data-open="settings"]').first().click();
  await first.locator('[data-switch="soundEnabled"]').click();
  await first.locator("[data-sheet='settings'] [data-close]").click();

  await first.waitForTimeout(4000);

  const counts = [await plays(first), await plays(second)];
  expect(counts.reduce((a, c) => a + c, 0)).toBeLessThanOrEqual(6);
  expect(counts.filter((c) => c > 0)).toHaveLength(1);
});

test("another tab takes over the sound when the owning tab closes", async ({ context }) => {
  const owner = await countingPage(context);
  await owner.evaluate((seed) => {
    seed.timer.sessionStartedAt = Date.now() - 5 * 60 * 1000;
    localStorage.setItem("deepwork:state", JSON.stringify(seed));
  }, RUNNING_WITH_SOUND);
  await owner.reload();
  await unlockAudio(owner);

  const other = await countingPage(context);
  await unlockAudio(other);

  await owner.waitForTimeout(2500);
  expect(await plays(other)).toBe(0); // the owner has it

  await owner.close();
  await other.evaluate(() => { window.__plays = 0; });
  await other.waitForTimeout(4000);

  expect(await plays(other)).toBeGreaterThan(0); // lease went stale, it took over
});
