# Copilot Instructions

## Project
Deep Work — a local-storage-only focus timer. No backend, no accounts. Tracks completed
focus minutes in `localStorage` and shows a GitHub-contributions-style yearly progress view.

## Stack
- Static HTML/CSS/JS
- GSAP (CDN) for transitions
- Deployed on Netlify

## Conventions
- Kebab-case filenames
- Small, focused functions
- No unused variables
- Vanilla ES modules (`<script type="module">`), no bundler
- All localStorage reads/writes go through `js/store.js` — never call
  `localStorage`/`JSON.parse` directly elsewhere

## Patterns to follow
- Single source of truth: `deepwork:state` in localStorage (see DESIGN.md for the shape)
- One module per concern (`timer.js`, `theme.js`, `layout.js`, `sound.js`, `progress.js`,
  `animations.js`) — `script.js` is the only file that touches the DOM directly and wires
  modules together via `onTick(render)`
- Visual state (light/dark, focus/break accent, big/small/corner layout) driven by
  `data-*` attributes on `<html>`, styled entirely through CSS custom properties — don't
  hardcode colors/spacing in component rules
- Derive remaining timer seconds from wall-clock delta (`sessionStartedAt`), not just a
  decrementing counter, so a backgrounded/reloaded tab doesn't drift
- Respect `prefers-reduced-motion` in `animations.js` before adding new GSAP timelines

## Avoid
- No bundler/build step — keep it plain static files
- No file-upload backgrounds (base64 in localStorage) — URL input only
- Don't record history minutes for cancelled sessions or break time

## Sync note
Keep this file in sync with DESIGN.md and AGENTS.md at the repo root.
