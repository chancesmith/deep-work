import { test, expect } from "@playwright/test";

// 2026-09-21T02:30:00Z is still 2026-09-20 21:30 in US Central — the window
// where the UTC date and the user's local date disagree.
const UTC_INSTANT = new Date("2026-09-21T02:30:00.000Z");
const LOCAL_DAY = "2026-09-20";
const UTC_DAY = "2026-09-21";

test.use({ timezoneId: "America/Chicago" });

test("localDateKey returns the local calendar day, not the UTC one", async ({ page }) => {
  await page.goto("/");
  const key = await page.evaluate(async (iso) => {
    const { localDateKey } = await import("/js/date.js");
    return localDateKey(new Date(iso));
  }, UTC_INSTANT.toISOString());

  expect(key).toBe(LOCAL_DAY);
  expect(key).not.toBe(UTC_DAY);
});

test("an evening session is credited to today, not tomorrow", async ({ page }) => {
  await page.clock.install({ time: UTC_INSTANT });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // finish a focus session outright
  await page.evaluate(async () => {
    const { store } = await import("/js/store.js");
    store.addFocusMinutes(25);
  });

  const history = await page.evaluate(
    () => JSON.parse(localStorage.getItem("deepwork:state")).history
  );
  expect(history[LOCAL_DAY]).toBe(25);
  expect(history[UTC_DAY]).toBeUndefined();
});

test("a session completing in the evening is credited to today end-to-end", async ({ page }) => {
  await page.clock.install({ time: UTC_INSTANT });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());

  // a running 25m focus session with 2s left on the clock
  await page.evaluate(() => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({
        settings: { autoResumeAfterBreak: false, completionSoundEnabled: false },
        timer: {
          mode: "focus",
          presetMinutes: 25,
          remainingSeconds: 2,
          running: true,
          sessionStartedAt: Date.now() - (25 * 60 - 2) * 1000,
        },
        history: {},
      })
    );
  });
  await page.reload();

  await page.clock.fastForward(4000); // let it run out and roll into the break

  await expect(page.locator("#stat-today")).toHaveText("25");
  const history = await page.evaluate(
    () => JSON.parse(localStorage.getItem("deepwork:state")).history
  );
  expect(history[LOCAL_DAY]).toBe(25);
  expect(history[UTC_DAY]).toBeUndefined();
});

test("the year heatmap marks the local day, not the UTC day", async ({ page }) => {
  await page.clock.install({ time: UTC_INSTANT });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((day) => {
    localStorage.setItem(
      "deepwork:state",
      JSON.stringify({ settings: {}, timer: {}, history: { [day]: 90 } })
    );
  }, LOCAL_DAY);
  await page.reload();

  await page.locator('[data-open="progress"]').first().click();

  // Sep 20 2026 is day-of-year 263 (1-indexed); Jan 1 2026 is a Thursday, so
  // Monday-first weeks start with 3 leading blanks.
  const filled = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("#heat-grid i")];
    return cells.filter((c) => c.dataset.lvl && c.dataset.lvl !== "0").length;
  });
  expect(filled).toBe(1); // exactly the one seeded day is lit
});
