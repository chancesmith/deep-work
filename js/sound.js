import { store } from "./store.js";

let ctx = null;
const buffers = {};

async function loadBuffer(name) {
  if (buffers[name]) return buffers[name];
  const res = await fetch(`sounds/${name}.mp3`);
  const arr = await res.arrayBuffer();
  buffers[name] = await ctx.decodeAudioData(arr);
  return buffers[name];
}

async function play(name) {
  if (!ctx) return;
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
