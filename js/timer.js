import { store } from "./store.js";
import { playTick, playChime } from "./sound.js";

const BREAK_SECONDS = 5 * 60;
const TICK_POLL_MS = 100;

let intervalId = null;
let listeners = [];
// Guards tick() against firing more than once for the same real-world second
// (e.g. overlapping intervals, or another browser tab sharing this
// localStorage racing to decrement the same counter) — remaining time is
// always derived fresh from wall-clock, never decremented relative to the
// last value, so duplicate invocations for the same second are no-ops.
let lastAnnouncedRemaining = null;

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

function computeRemaining(timer) {
  const total = timer.mode === "focus" ? timer.presetMinutes * 60 : BREAK_SECONDS;
  const elapsed = Math.floor((Date.now() - timer.sessionStartedAt) / 1000);
  return Math.max(0, total - elapsed);
}

// Recompute remaining time from wall-clock so a backgrounded/reloaded tab
// doesn't just resume a stale setInterval countdown.
function reconcileOnResume() {
  const { timer } = store.get();
  if (!timer.running || !timer.sessionStartedAt) return;
  const remaining = computeRemaining(timer);
  lastAnnouncedRemaining = remaining;
  persist({ remainingSeconds: remaining });
  if (remaining === 0) completeSession();
}

// Marks the second that's currently on screen as already announced, so the
// next tick only fires when the countdown genuinely rolls over. Without this,
// resuming re-announces (and re-ticks) the second that already sounded before
// the pause — an audible double tick with no digit change.
function armAnnounceAt(timer) {
  lastAnnouncedRemaining =
    timer.running && timer.sessionStartedAt ? computeRemaining(timer) : timer.remainingSeconds;
}

function tick() {
  const { timer } = store.get();
  if (!timer.running || !timer.sessionStartedAt) return;

  const remaining = computeRemaining(timer);
  if (remaining === lastAnnouncedRemaining) return; // already handled this second
  lastAnnouncedRemaining = remaining;

  persist({ remainingSeconds: remaining });

  if (timer.mode === "focus") playTick();
  notify();

  if (remaining === 0) completeSession();
}

function completeSession() {
  const { timer, settings } = store.get();

  if (timer.mode === "focus") {
    store.addFocusMinutes(timer.presetMinutes);
    playChime();
    const next = persist({
      mode: "break",
      remainingSeconds: BREAK_SECONDS,
      running: true,
      sessionStartedAt: Date.now(),
    });
    armAnnounceAt(next.timer);
    notify();
    return next;
  }

  // break finished
  const shouldAutoResume = settings.autoResumeAfterBreak;
  const next = persist({
    mode: "focus",
    remainingSeconds: timer.presetMinutes * 60,
    running: shouldAutoResume,
    sessionStartedAt: shouldAutoResume ? Date.now() : null,
  });
  armAnnounceAt(next.timer);
  notify();
}

export function initTimer() {
  reconcileOnResume();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reconcileOnResume();
  });
  // Polled well under 1s: tick() is a cheap no-op until the wall-clock second
  // actually rolls over, and polling at 1s left the digit (and its tick sound)
  // up to a full second behind the real boundary, which felt laggy.
  intervalId = setInterval(tick, TICK_POLL_MS);
  notify();
}

export function start(presetMinutes) {
  const { timer } = store.get();
  const minutes = presetMinutes ?? timer.presetMinutes;
  const next = persist({
    mode: "focus",
    presetMinutes: minutes,
    remainingSeconds: minutes * 60,
    running: true,
    sessionStartedAt: Date.now(),
  });
  armAnnounceAt(next.timer);
  notify();
}

export function togglePause() {
  const { timer } = store.get();
  if (!timer.running && timer.remainingSeconds === (timer.mode === "focus" ? timer.presetMinutes * 60 : BREAK_SECONDS) && !timer.sessionStartedAt) {
    start(timer.presetMinutes);
    return;
  }
  const next = persist({
    running: !timer.running,
    sessionStartedAt: !timer.running ? Date.now() - (timer.presetMinutes * 60 - timer.remainingSeconds) * 1000 : timer.sessionStartedAt,
  });
  armAnnounceAt(next.timer);
  notify();
}

export function reset() {
  const { timer } = store.get();
  const next = persist({
    mode: "focus",
    running: false,
    remainingSeconds: timer.presetMinutes * 60,
    sessionStartedAt: null,
  });
  armAnnounceAt(next.timer);
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
