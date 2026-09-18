import { store } from "./store.js";

const MIN_REPLAY_GAP_MS = 150; // guards against any duplicate trigger sounding like an echo

let ctx = null;
const bufferPromises = {};
const lastPlayedAt = {};

function loadBuffer(name) {
  // Cache the in-flight promise, not just the resolved buffer — otherwise two
  // calls to play() before the first fetch+decode finishes each start their
  // own fetch/decode and both end up playing, sounding like a doubled tick.
  if (!bufferPromises[name]) {
    bufferPromises[name] = fetch(`sounds/${name}.mp3`)
      .then((res) => res.arrayBuffer())
      .then((arr) => ctx.decodeAudioData(arr))
      .catch((err) => {
        delete bufferPromises[name]; // allow retry on next play() if this attempt failed
        throw err;
      });
  }
  return bufferPromises[name];
}

async function play(name) {
  if (!ctx) return;

  const now = performance.now();
  if (now - (lastPlayedAt[name] ?? -Infinity) < MIN_REPLAY_GAP_MS) return;
  lastPlayedAt[name] = now;

  try {
    const buffer = await loadBuffer(name);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* sound file missing or blocked — fail silently, timer keeps running */
  }
}

export function initSound() {
  document.addEventListener(
    "pointerdown",
    () => {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    { once: true }
  );
}

export function playTick() {
  const { settings } = store.get();
  if (!settings.soundEnabled) return;
  play(settings.soundChoice);
}

export function playChime() {
  const { settings } = store.get();
  if (!settings.completionSoundEnabled) return;
  play("chime");
}
