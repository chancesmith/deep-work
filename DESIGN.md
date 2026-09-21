# Design

## Style
Minimal — think dan-mall.com / ugmonk.com / todoist.com. Lots of whitespace,
restrained type, no visual clutter, no gradients/shadows-for-decoration.

## Visual system
- Type: Inter, big tabular-nums countdown, tight tracking (`-.045em`), light weight (300).
- Color: warm off-white `#FAF9F6` / near-black base in light; `#121212` / off-white in dark.
  Single accent — rust (`#C2410C`) for focus, sage (`#3F6E5E`) for break — swapped via a
  `[data-state="break"]` CSS variable override so the whole UI repaints with one selector.
  Break mode also tints the page background a few percent toward the break accent so the
  mode is readable at a glance.
- All colors/spacing/type sizes are CSS custom properties (`style.css` `:root` / `[data-theme]`),
  no magic numbers scattered through component rules.
- `prefers-reduced-motion: reduce` disables all GSAP motion.

## Animations
GSAP (https://gsap.com/docs/v3/) — used for timer transitions, layout mode
switches, and the yearly progress reveal. Motion stays subtle: fades/scale, no bounce.

## Features
- localStorage tracking of completed focus minutes (`js/store.js`, key `deepwork:state`)
- Default timer presets: 25 min, 45 min, 1 hour, 4 hours
- Auto-transitions: focus session → 5 min break → back to focus (loops if
  "auto-resume after break" is on; otherwise returns to idle at the same preset)
- Optional ticking/clicking sound during focus (toggle + tick/click choice, Web Audio)
- Countdown display (not count-up), progress rendered as a thin rule under the digits
- Light/dark/system mode toggle
- Layout options:
  - **Big** — full-viewport centered timer
  - **Small** — compact centered card
  - **Corner** — floating bottom-right pill widget, minimal chrome (time + pause only)
- Optional custom background: solid color or image (image via URL only — no file upload,
  to avoid bloating localStorage with base64 data). Color and image URL are stored in
  **separate** fields so switching type keeps both values; only the control for the
  selected type is shown. Image URLs are normalised through the URL parser and rejected
  unless http(s), so they can't break out of the CSS `url("...")` value
- Escape closes any open modal, including while a text field has focus
- Yearly focus progress view — GitHub-contributions-style heatmap (Mon-first weeks,
  month labels aligned to real week columns), plus hours/days/streak summary stats
- Keyboard shortcuts: `space` start/pause, `r` reset, `s` toggle settings, `y` toggle
  year progress, `l` cycle layout (big → small → corner) — ignored while a text input
  has focus (see `isTypingTarget` in `script.js`)
- Page title shows the live countdown (`MM:SS · Focus/Break/Paused`) so a background tab
  stays readable; reverts to "Deep Work" when idle
- Soft two-note chime plays when a focus session completes (not on break completion),
  independent of the ticking-sound toggle — its own switch in settings, on by default

## Known gotcha: audio buffer loading race
`js/sound.js` memoizes the **in-flight fetch+decode promise** for each sound, not just
the resolved buffer. If two plays of the same sound are triggered before the first
fetch/decode resolves (e.g. rapid pause/resume on the very first tick after enabling
sound), caching only the resolved buffer let both calls independently decode and play,
audibly doubling the sound. A `MIN_REPLAY_GAP_MS` guard in `play()` also caps how often
the same sound can fire, as defense-in-depth against any other duplicate-trigger path.

## Performance notes (older machines)
The always-on cost is the once-per-second render plus the timer poll, so:
- `store.read()` memoises the parsed state against the exact raw string it came from.
  The cheap `getItem` still runs every poll (so writes from any source — this tab,
  another tab, devtools — are picked up), but `JSON.parse` only runs when the stored
  value actually changed.
- `script.js` caches the nodes `render()` touches instead of re-querying each pass, and
  `setText()` skips writes whose value is unchanged.
- The progress bar animates `transform: scaleX()`, not `width` — `width` relaid out the
  row every second; a transform is composited.
- No `backdrop-filter` behind image backgrounds (the 0.82 veil already does the
  readability work; a full-screen blur was a permanent cost whenever one was set).

## Open bug: ticking sound still doubles in some conditions
See [issue #1](https://github.com/chancesmith/deep-work/issues/1). Several real causes
have been found and fixed (see the gotchas below, and keep their regression tests), but
doubling is still reported. **Leading suspect: the audio was never made multi-tab safe.**
`0a3ea96` made the *countdown* idempotent across tabs, but every open tab still runs its
own poll loop and calls `playTick()` independently — two open tabs measurably produce
~8 audible ticks per 4 seconds, on independent phases. Likely fix is sound ownership
(a visibility gate and/or leader election via `BroadcastChannel`). Read the issue before
attempting another fix; it lists what's already been ruled out with evidence.

## Known gotcha: resuming must not re-announce the current second
`js/timer.js` dedupes ticks with `lastAnnouncedRemaining`. Anything that changes timer
state (start/resume/reset/session rollover) must call `armAnnounceAt()` to point that
guard at the second *currently on screen* — **not** reset it to `null`. Setting it to
`null` disarms the guard, so the first tick after resuming re-announces the second that
already sounded: an audible double tick with no digit change. This is exactly the bug
that shipped when the guard was first added; the regression signature to test for is
"two tick sounds for the same displayed second" (see `tests/tick-no-double.spec.js`).

`tick()` is polled every `TICK_POLL_MS` (100ms), not 1000ms. It's a cheap no-op until
the wall-clock second actually rolls over, and polling at 1s meant the interval's phase
(anchored to page load) could sit up to a full second away from the countdown's real
boundaries (anchored to `sessionStartedAt`), so the digit and its tick landed late.

## Known gotcha: suspended AudioContext queues playback instead of dropping it
`js/sound.js` creates its `AudioContext` on the first `pointerdown` (required by
autoplay policy) but a freshly-created context can start in, or later drift into, a
`"suspended"` state — notably on Safari, which is stricter than Chromium about
honoring an implicit resume. Calling `source.start(0)` on a suspended context doesn't
play anything or error — it silently schedules the source at time-zero, queued until
something resumes the context. If several ticks get scheduled this way, they all
become audible **at once** the instant a later, unrelated user gesture (e.g. opening
settings) triggers the browser's own auto-resume — heard as a doubled/burst tick, and
explains why the first audible tick can feel late relative to the visible countdown.
Note that `await ctx.resume()` does **not** solve this — it just moves the backlog from
the audio graph into pending promises that all resolve together. The fix is to resume
inside the unlocking gesture, and in `play()` to ask for a resume and then **drop** the
current sound if the context isn't running yet (a tick only means something at the
moment it happens; a late one is worse than none). The post-decode path re-checks
`ctx.state` too, since the context can suspend while a buffer is still decoding.

Short SFX (`tick.wav`, `click.wav`, `chime.wav`) are WAV, not MP3 — MP3 encoding adds
~20–50ms of silent encoder-priming padding before the audio content starts, which is
proportionally huge (and audible) on a ~40ms tick.

## Known gotcha: countdown is derived from wall clock, not decremented
`js/timer.js` computes `remainingSeconds` fresh from `Date.now() - sessionStartedAt`
every tick (`computeRemaining`), rather than decrementing the previous stored value.
A `lastAnnouncedRemaining` guard skips any tick that recomputes the *same* second that
was already announced. This makes ticking idempotent no matter how many times or from
how many sources it's invoked — the concrete bug this fixed: opening the app in a
second browser tab (same origin, same localStorage) meant both tabs independently
decremented the same shared counter, so the visible countdown skipped every other
second and the tick sound audibly doubled. Wall-clock-derived ticking makes every tab
compute the identical correct value instead of compounding relative decrements.

## Data model (localStorage, key `deepwork:state`)
```js
{
  settings: {
    theme: "light" | "dark" | "system",
    layout: "big" | "small" | "corner",
    soundEnabled: bool,
    soundChoice: "tick" | "click",
    backgroundType: "none" | "color" | "image",
    backgroundColor: string,      // hex, e.g. "#DCD9CE"
    backgroundImageUrl: string,   // http(s) only
    autoResumeAfterBreak: bool,   // defaults true
    defaultPresetMinutes: number
  },
  timer: {
    mode: "focus" | "break",
    remainingSeconds: number,
    running: bool,
    presetMinutes: number,
    sessionStartedAt: timestamp | null
  },
  history: { "2026-09-18": 45 }   // date -> completed focus minutes
}
```
Only **completed** focus sessions write to `history`; cancels and breaks do not.
Remaining time is reconciled from wall-clock delta against `sessionStartedAt` on load and
on `visibilitychange`, so a backgrounded or reloaded tab doesn't drift or lose progress.

## File layout
```
index.html
style.css
script.js          -- entry, wires modules to the DOM
/js
  store.js         -- localStorage read/write/patch
  timer.js         -- countdown + focus/break state machine
  sound.js         -- Web Audio tick/click playback
  theme.js         -- light/dark/system apply + persist
  layout.js        -- big/small/corner switching
  progress.js      -- year heatmap render from history
  animations.js    -- GSAP timelines
/sounds
  tick.wav
  click.wav
```
Vanilla ES modules, no bundler — static hosting needs none.

## Testing
Playwright (`tests/`) covers the timer state machine, layout switching (including the
corner-layout escape hatch), and settings reset. Run with `npm test` (installs browsers
once via `npx playwright install chromium`).
