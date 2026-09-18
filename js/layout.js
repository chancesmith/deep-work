import { store } from "./store.js";

export function initLayout() {
  const { settings } = store.get();
  document.documentElement.dataset.layout = settings.layout;
}

export function setLayout(layout, { animate } = {}) {
  store.patch({ settings: { layout } });
  document.documentElement.dataset.layout = layout;
  if (animate) animate();
}
