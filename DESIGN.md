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
  to avoid bloating localStorage with base64 data)
- Yearly focus progress view — GitHub-contributions-style heatmap (Mon-first weeks,
  month labels aligned to real week columns), plus hours/days/streak summary stats
- Keyboard shortcuts: `space` start/pause, `r` reset, `s` toggle settings, `y` toggle
  year progress — ignored while a text input has focus (see `isTypingTarget` in `script.js`)

## Data model (localStorage, key `deepwork:state`)
```js
{
  settings: {
    theme: "light" | "dark" | "system",
    layout: "big" | "small" | "corner",
    soundEnabled: bool,
    soundChoice: "tick" | "click",
    background: { type: "none" | "color" | "image", value: string },
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
  tick.mp3
  click.mp3
```
Vanilla ES modules, no bundler — static hosting needs none.

## Testing
Playwright (`tests/`) covers the timer state machine, layout switching (including the
corner-layout escape hatch), and settings reset. Run with `npm test` (installs browsers
once via `npx playwright install chromium`).
