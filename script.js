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

function weekMinutes(history) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - day);
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    total += history[d.toISOString().slice(0, 10)] || 0;
  }
  return total;
}

function render(state) {
  const { timer, history, settings } = state;
  const isIdle = !timer.running && timer.remainingSeconds === timer.presetMinutes * 60 && !timer.sessionStartedAt;
  const visualState = isIdle ? "idle" : timer.mode;

  const prevState = root.dataset.state;
  root.dataset.state = visualState;

  $("#label").textContent = LABEL[visualState];
  $("#digits").textContent = formatTime(timer.remainingSeconds);

  const total = timer.mode === "focus" ? timer.presetMinutes * 60 : BREAK_SECONDS;
  $("#track").style.setProperty("--pct", isIdle ? 0 : 1 - timer.remainingSeconds / total);

  $("#primary").textContent = isIdle ? "Start" : timer.running ? "Pause" : "Resume";
  $("#widget-toggle").setAttribute("aria-label", timer.running ? "Pause" : "Start");
  $(".icon-pause", $("#widget-toggle")).classList.toggle("is-hidden", !timer.running);
  $(".icon-play", $("#widget-toggle")).classList.toggle("is-hidden", timer.running);

  $$(".chip").forEach((c) => c.classList.toggle("is-on", Number(c.dataset.minutes) === timer.presetMinutes));

  const today = new Date().toISOString().slice(0, 10);
  $("#stat-today").textContent = history[today] || 0;
  $("#stat-week").textContent = (weekMinutes(history) / 60).toFixed(1);
  $("#foot-note").textContent = isIdle
    ? "no session running"
    : timer.mode === "focus"
    ? "break follows this session"
    : settings.autoResumeAfterBreak
    ? "focus resumes automatically"
    : "resume focus when ready";

  const crossedMode = (prevState === "break") !== (visualState === "break");
  if (crossedMode) fadeModeSwitch([$("#label"), $("#digits")]);
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
$('[data-seg="background-type"]').addEventListener("click", (e) => {
  if (!e.target.dataset.value) return;
  const type = e.target.dataset.value;
  const { settings } = store.get();
  store.patch({ settings: { background: { type, value: settings.background.value } } });
  paintSeg(e.currentTarget, type);
  applyBackground(store.get().settings.background);
});
bgUrlInput.addEventListener("change", () => {
  const { settings } = store.get();
  store.patch({ settings: { background: { type: settings.background.type, value: bgUrlInput.value.trim() } } });
  applyBackground(store.get().settings.background);
});

function applyBackground(background) {
  root.dataset.bg = background.type;
  $(".bg").style.backgroundImage = background.type === "image" && background.value ? `url("${background.value}")` : "";
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
  paintSeg($('[data-seg="background-type"]'), settings.background.type);
  bgUrlInput.value = settings.background.value;
  applyBackground(settings.background);

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
