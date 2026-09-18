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

export function initSound() {
  document.addEventListener(
    "pointerdown",
    () => {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    { once: true }
  );
}

export async function playTick() {
  const { settings } = store.get();
  if (!settings.soundEnabled || !ctx) return;
  try {
    const buffer = await loadBuffer(settings.soundChoice);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* sound file missing or blocked — fail silently, timer keeps running */
  }
}
