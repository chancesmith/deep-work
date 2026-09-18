import { store } from "./store.js";
import { playTick } from "./sound.js";

const BREAK_SECONDS = 5 * 60;

let intervalId = null;
let listeners = [];

export function onTick(fn) {
  listeners.push(fn);
}

function notify() {
  const state = store.get();
  listeners.forEach((fn) => fn(state));
}

function persist(timerPatch) {
  return store.patch({ timer: timerPatch });
}

// Recompute remaining time from wall-clock so a backgrounded/reloaded tab
// doesn't just resume a stale setInterval countdown.
function reconcileOnResume() {
  const { timer } = store.get();
  if (!timer.running || !timer.sessionStartedAt) return;
  const elapsed = Math.floor((Date.now() - timer.sessionStartedAt) / 1000);
  const total = timer.mode === "focus" ? timer.presetMinutes * 60 : BREAK_SECONDS;
  const remaining = Math.max(0, total - elapsed);
  persist({ remainingSeconds: remaining });
  if (remaining === 0) completeSession();
}

function tick() {
  const { timer } = store.get();
  if (!timer.running) return;

  const remaining = Math.max(0, timer.remainingSeconds - 1);
  persist({ remainingSeconds: remaining });

  if (timer.mode === "focus") playTick();
  notify();

  if (remaining === 0) completeSession();
}

function completeSession() {
  const { timer, settings } = store.get();

  if (timer.mode === "focus") {
    store.addFocusMinutes(timer.presetMinutes);
    const next = persist({
      mode: "break",
      remainingSeconds: BREAK_SECONDS,
      running: true,
      sessionStartedAt: Date.now(),
    });
    notify();
    return next;
  }

  // break finished
  const shouldAutoResume = settings.autoResumeAfterBreak;
  persist({
    mode: "focus",
    remainingSeconds: timer.presetMinutes * 60,
    running: shouldAutoResume,
    sessionStartedAt: shouldAutoResume ? Date.now() : null,
  });
  notify();
}

export function initTimer() {
  reconcileOnResume();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconcileOnResume();
  });
  intervalId = setInterval(tick, 1000);
  notify();
}

export function start(presetMinutes) {
  const { timer } = store.get();
  const minutes = presetMinutes ?? timer.presetMinutes;
  persist({
    mode: "focus",
    presetMinutes: minutes,
    remainingSeconds: minutes * 60,
    running: true,
    sessionStartedAt: Date.now(),
  });
  notify();
}

export function togglePause() {
  const { timer } = store.get();
  if (!timer.running && timer.remainingSeconds === (timer.mode === "focus" ? timer.presetMinutes * 60 : BREAK_SECONDS) && !timer.sessionStartedAt) {
    start(timer.presetMinutes);
    return;
  }
  persist({
    running: !timer.running,
    sessionStartedAt: !timer.running ? Date.now() - (timer.presetMinutes * 60 - timer.remainingSeconds) * 1000 : timer.sessionStartedAt,
  });
  notify();
}

export function reset() {
  const { timer } = store.get();
  persist({
    mode: "focus",
    running: false,
    remainingSeconds: timer.presetMinutes * 60,
    sessionStartedAt: null,
  });
  notify();
}

export function setPreset(minutes) {
  const { timer } = store.get();
  if (timer.running) return;
  persist({ presetMinutes: minutes, remainingSeconds: minutes * 60 });
  store.patch({ settings: { defaultPresetMinutes: minutes } });
  notify();
}

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
