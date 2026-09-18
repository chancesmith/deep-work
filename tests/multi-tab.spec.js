import { test, expect } from "@playwright/test";

function secondsFromDigits(text) {
  const [m, s] = text.split(":").map(Number);
  return m * 60 + s;
}

test("a second tab sharing localStorage does not make this tab's countdown skip seconds", async ({ context }) => {
  const pageA = await context.newPage();
  await pageA.goto("/");
  await pageA.evaluate(() => localStorage.clear());
  await pageA.evaluate(() => {
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
        timer: { mode: "focus", remainingSeconds: 40 * 60, running: true, presetMinutes: 45, sessionStartedAt: Date.now() - 5 * 60 * 1000 },
        history: {},
      })
    );
  });
  await pageA.reload();

  // second tab, same origin, same localStorage — also running its own tick loop
  const pageB = await context.newPage();
  await pageB.goto("/");

  const seen = [];
  const start = Date.now();
  let last = null;
  while (Date.now() - start < 4000) {
    const text = await pageA.locator("#digits").textContent();
    const value = secondsFromDigits(text);
    if (value !== last) {
      seen.push(value);
      last = value;
    }
    await pageA.waitForTimeout(50);
  }

  for (let i = 1; i < seen.length; i++) {
    expect(seen[i - 1] - seen[i]).toBe(1);
  }

  await pageA.close();
  await pageB.close();
});
