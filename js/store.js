const KEY = "deepwork:state";

const DEFAULTS = {
  settings: {
    theme: "system",
    layout: "big",
    soundEnabled: false,
    soundChoice: "tick",
    background: { type: "none", value: "" },
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

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      settings: { ...DEFAULTS.settings, ...parsed.settings },
      timer: { ...DEFAULTS.timer, ...parsed.timer },
      history: parsed.history || {},
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
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
    const today = new Date().toISOString().slice(0, 10);
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
