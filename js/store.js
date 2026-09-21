import { localDateKey } from "./date.js";

const KEY = "deepwork:state";

const DEFAULTS = {
  settings: {
    theme: "system",
    layout: "big",
    soundEnabled: false,
    soundChoice: "tick",
    completionSoundEnabled: true,
    backgroundType: "none",
    backgroundColor: "#DCD9CE",
    backgroundImageUrl: "",
    autoResumeAfterBreak: true,
    defaultPresetMinutes: 45,
  },
  timer: {
    mode: "focus",
    remainingSeconds: 45 * 60,
    running: false,
    presetMinutes: 45,
    sessionStartedAt: null,
  },
  history: {},
};

// Background used to be { type, value } with one `value` shared by colour and
// image, so switching type clobbered the other one. Split into three fields.
function migrateSettings(settings) {
  const next = { ...settings };
  const legacy = next.background;
  if (legacy && typeof legacy === "object") {
    next.backgroundType = legacy.type ?? "none";
    if (legacy.type === "image") next.backgroundImageUrl = legacy.value || "";
    if (legacy.type === "color") next.backgroundColor = legacy.value || DEFAULTS.settings.backgroundColor;
    delete next.background;
  }
  return next;
}

// read() runs on every timer poll, and re-parsing the JSON each time showed up
// as jank on slower machines. The parsed state is memoised against the exact
// raw string it came from: the cheap getItem still happens every call, so a
// write from anywhere (this tab, another tab, devtools) is always picked up,
// but the parse only runs when the stored value actually differs.
let cache = null;
let cacheRaw = null;

function read() {
  const raw = localStorage.getItem(KEY);
  if (cache && raw === cacheRaw) return cache;

  cacheRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    cache = {
      settings: { ...DEFAULTS.settings, ...migrateSettings(parsed.settings || {}) },
      timer: { ...DEFAULTS.timer, ...parsed.timer },
      history: parsed.history || {},
    };
  } catch {
    cache = structuredClone(DEFAULTS);
  }
  return cache;
}

function write(state) {
  const raw = JSON.stringify(state);
  localStorage.setItem(KEY, raw);
  cacheRaw = raw;
  cache = state;
}

export const store = {
  get: read,
  set: write,
  patch(partial) {
    const state = read();
    const next = {
      settings: { ...state.settings, ...(partial.settings || {}) },
      timer: { ...state.timer, ...(partial.timer || {}) },
      history: partial.history ? { ...state.history, ...partial.history } : state.history,
    };
    write(next);
    return next;
  },
  addFocusMinutes(minutes) {
    if (minutes <= 0) return read();
    const state = read();
    const today = localDateKey();
    const history = { ...state.history, [today]: (state.history[today] || 0) + minutes };
    const next = { ...state, history };
    write(next);
    return next;
  },
  resetSettings() {
    const state = read();
    const next = {
      settings: structuredClone(DEFAULTS.settings),
      timer: structuredClone(DEFAULTS.timer),
      history: state.history,
    };
    write(next);
    return next;
  },
};
