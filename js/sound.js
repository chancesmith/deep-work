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
    bufferPromises[name] = fetch(`sounds/${name}.wav`)
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

  // A suspended context still accepts start() calls — it just queues them at
  // time-zero instead of playing. Awaiting resume() is no better: the pending
  // plays pile up and all resolve together. Either way they fire as one burst
  // the instant a later gesture (e.g. opening settings) resumes the context.
  // So: ask it to resume and drop *this* sound. A tick is only meaningful at
  // the moment it happens — a late one is worse than none.
  if (ctx.state !== "running") {
    ctx.resume();
    return;
  }

  const now = performance.now();
  if (now - (lastPlayedAt[name] ?? -Infinity) < MIN_REPLAY_GAP_MS) return;
  lastPlayedAt[name] = now;

  try {
    const buffer = await loadBuffer(name);
    if (ctx.state !== "running") return; // suspended while we were decoding

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch {
    /* sound file missing or blocked — fail silently, timer keeps running */
  }
}

export function initSound() {
  document.addEventListener(
    "pointerdown",
    () => {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Resume synchronously within the gesture handler — some browsers
        // (notably Safari) only honor resume() when called directly inside
        // the user-gesture callback, not from a later async tick.
        ctx.resume();
      }
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
