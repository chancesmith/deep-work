import { store } from "./store.js";

const mq = matchMedia("(prefers-color-scheme: dark)");

function apply(theme) {
  const resolved = theme === "system" ? (mq.matches ? "dark" : "light") : theme;
  document.documentElement.dataset.theme = resolved;
}

export function initTheme() {
  const { settings } = store.get();
  apply(settings.theme);
  mq.addEventListener("change", () => {
    if (store.get().settings.theme === "system") apply("system");
  });
}

export function setTheme(theme) {
  store.patch({ settings: { theme } });
  apply(theme);
}
