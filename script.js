import { store } from "./js/store.js";
import { initTheme, setTheme } from "./js/theme.js";
import { initLayout, setLayout } from "./js/layout.js";
import { initSound } from "./js/sound.js";
import { initTimer, onTick, start, togglePause, reset, setPreset, formatTime } from "./js/timer.js";
import { renderProgress } from "./js/progress.js";
import { fadeModeSwitch, layoutSwitch, sheetOpen } from "./js/animations.js";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const BREAK_SECONDS = 5 * 60;
const root = document.documentElement;

const LABEL = { idle: "Ready", focus: "Focus", break: "Break" };

// render() runs every second, so the nodes it touches are looked up once here
// rather than re-queried on each pass.
const el = {
  label: $("#label"),
  digits: $("#digits"),
  track: $("#track"),
  primary: $("#primary"),
  widgetToggle: $("#widget-toggle"),
  iconPause: $("#widget-toggle .icon-pause"),
  iconPlay: $("#widget-toggle .icon-play"),
  chips: $$(".chip"),
  statToday: $("#stat-today"),
  statWeek: $("#stat-week"),
  footNote: $("#foot-note"),
};

// Skips the write when the value is unchanged — most of these only change
// once a session, not once a second.
function setText(node, value) {
  const text = String(value);
  if (node.textContent !== text) node.textContent = text;
}

let weekCache = { key: null, history: null, total: 0 };
function weekMinutes(history) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);

  const key = monday.toDateString();
  if (weekCache.key === key && weekCache.history === history) return weekCache.total;

  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    total += history[d.toISOString().slice(0, 10)] || 0;
  }
  weekCache = { key, history, total };
  return total;
}

function render(state) {
  const { timer, history, settings } = state;
  const isIdle = !timer.running && timer.remainingSeconds === timer.presetMinutes * 60 && !timer.sessionStartedAt;
  const visualState = isIdle ? "idle" : timer.mode;

  const prevState = root.dataset.state;
  root.dataset.state = visualState;

  setText(el.label, LABEL[visualState]);
  setText(el.digits, formatTime(timer.remainingSeconds));

  const total = timer.mode === "focus" ? timer.presetMinutes * 60 : BREAK_SECONDS;
  el.track.style.setProperty("--pct", isIdle ? 0 : 1 - timer.remainingSeconds / total);

  setText(el.primary, isIdle ? "Start" : timer.running ? "Pause" : "Resume");
  el.widgetToggle.setAttribute("aria-label", timer.running ? "Pause" : "Start");
  el.iconPause.classList.toggle("is-hidden", !timer.running);
  el.iconPlay.classList.toggle("is-hidden", timer.running);

  el.chips.forEach((c) => c.classList.toggle("is-on", Number(c.dataset.minutes) === timer.presetMinutes));

  const today = new Date().toISOString().slice(0, 10);
  setText(el.statToday, history[today] || 0);
  setText(el.statWeek, (weekMinutes(history) / 60).toFixed(1));
  setText(el.footNote, isIdle
    ? "no session running"
    : timer.mode === "focus"
    ? "break follows this session"
    : settings.autoResumeAfterBreak
    ? "focus resumes automatically"
    : "resume focus when ready");

  const crossedMode = (prevState === "break") !== (visualState === "break");
  if (crossedMode) fadeModeSwitch([$("#label"), $("#digits")]);

  const title = isIdle
    ? "Deep Work"
    : `${formatTime(timer.remainingSeconds)} · ${timer.running ? LABEL[visualState] : "Paused"}`;
  if (document.title !== title) document.title = title;
}

/* ---- timer controls ---- */
$("#primary").addEventListener("click", togglePause);
$("#reset-btn").addEventListener("click", reset);
$("#widget-toggle").addEventListener("click", togglePause);
$$(".chip").forEach((chip) =>
  chip.addEventListener("click", () => setPreset(Number(chip.dataset.minutes)))
);

/* ---- sheets ---- */
function openSheet(name) {
  const sheet = $(`[data-sheet="${name}"]`);
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  sheetOpen(sheet);
  if (name === "progress") renderProgress();
}
function closeSheets() {
  $$(".sheet.is-open").forEach((sheet) => {
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
  });
}
$$("[data-open]").forEach((b) => b.addEventListener("click", () => openSheet(b.dataset.open)));
$$("[data-close]").forEach((b) => b.addEventListener("click", closeSheets));
$$(".sheet").forEach((s) => s.addEventListener("click", (e) => e.target === s && closeSheets()));
addEventListener("keydown", (e) => e.key === "Escape" && closeSheets());

/* ---- keyboard shortcuts ---- */
function isTypingTarget(el) {
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

addEventListener("keydown", (e) => {
  if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case " ":
      e.preventDefault();
      togglePause();
      break;
    case "r":
      reset();
      break;
    case "s":
      $('[data-sheet="settings"]').classList.contains("is-open") ? closeSheets() : openSheet("settings");
      break;
    case "y":
      $('[data-sheet="progress"]').classList.contains("is-open") ? closeSheets() : openSheet("progress");
      break;
    case "l":
      cycleLayout();
      break;
  }
});

const LAYOUTS = ["big", "small", "corner"];
function cycleLayout() {
  const next = LAYOUTS[(LAYOUTS.indexOf(root.dataset.layout) + 1) % LAYOUTS.length];
  setLayout(next, { animate: () => layoutSwitch($(".stage")) });
  paintSeg($('[data-seg="layout"]'), next);
}

/* ---- settings: segmented controls ---- */
function paintSeg(seg, value) {
  $$(".seg__opt", seg).forEach((opt) => opt.classList.toggle("is-on", opt.dataset.value === value));
}

$('[data-seg="theme"]').addEventListener("click", (e) => {
  if (!e.target.dataset.value) return;
  setTheme(e.target.dataset.value);
  paintSeg(e.currentTarget, e.target.dataset.value);
});

$('[data-seg="layout"]').addEventListener("click", (e) => {
  if (!e.target.dataset.value) return;
  setLayout(e.target.dataset.value, { animate: () => layoutSwitch($(".stage")) });
  paintSeg(e.currentTarget, e.target.dataset.value);
});

$('[data-seg="soundChoice"]').addEventListener("click", (e) => {
  if (!e.target.dataset.value) return;
  store.patch({ settings: { soundChoice: e.target.dataset.value } });
  paintSeg(e.currentTarget, e.target.dataset.value);
});

const bgUrlInput = $("#bg-url");
const bgColorInput = $("#bg-color");

$('[data-seg="background-type"]').addEventListener("click", (e) => {
  if (!e.target.dataset.value) return;
  const backgroundType = e.target.dataset.value;
  // only the type changes here — the colour and the image URL keep their own
  // saved values, so switching back and forth doesn't lose either one
  applyBackground(store.patch({ settings: { backgroundType } }).settings);
  paintSeg(e.currentTarget, backgroundType);
});

bgUrlInput.addEventListener("change", () => {
  applyBackground(store.patch({ settings: { backgroundImageUrl: bgUrlInput.value.trim() } }).settings);
});

bgColorInput.addEventListener("input", () => {
  const backgroundColor = bgColorInput.value;
  $("#bg-color-value").textContent = backgroundColor;
  applyBackground(store.patch({ settings: { backgroundColor } }).settings);
});

// Only http(s) URLs, normalised through the URL parser so quotes and parens
// come back percent-encoded and can't break out of the CSS url("...") value.
function safeImageUrl(raw) {
  if (!raw) return "";
  try {
    const url = new URL(raw, location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function applyBackground(settings) {
  const { backgroundType, backgroundColor, backgroundImageUrl } = settings;
  root.dataset.bg = backgroundType;
  root.style.setProperty("--user-bg", backgroundColor);

  const url = backgroundType === "image" ? safeImageUrl(backgroundImageUrl) : "";
  $(".bg").style.backgroundImage = url ? `url("${url}")` : "";
}

/* ---- settings: switches ---- */
$$(".switch[data-switch]").forEach((sw) => {
  sw.addEventListener("click", () => {
    const key = sw.dataset.switch;
    const { settings } = store.get();
    const next = !settings[key];
    store.patch({ settings: { [key]: next } });
    sw.classList.toggle("is-on", next);
    sw.setAttribute("aria-checked", String(next));
  });
});

$("#reset-defaults").addEventListener("click", () => {
  const state = store.resetSettings();
  initTheme();
  initLayout();
  hydrateSettingsUI();
  render(state);
});

/* ---- init from stored settings ---- */
function hydrateSettingsUI() {
  const { settings } = store.get();
  paintSeg($('[data-seg="theme"]'), settings.theme);
  paintSeg($('[data-seg="layout"]'), settings.layout);
  paintSeg($('[data-seg="soundChoice"]'), settings.soundChoice);
  paintSeg($('[data-seg="background-type"]'), settings.backgroundType);
  bgUrlInput.value = settings.backgroundImageUrl;
  bgColorInput.value = settings.backgroundColor;
  $("#bg-color-value").textContent = settings.backgroundColor;
  applyBackground(settings);

  $$(".switch[data-switch]").forEach((sw) => {
    const on = Boolean(settings[sw.dataset.switch]);
    sw.classList.toggle("is-on", on);
    sw.setAttribute("aria-checked", String(on));
  });
}

initTheme();
initLayout();
initSound();
hydrateSettingsUI();
onTick(render);
initTimer();
