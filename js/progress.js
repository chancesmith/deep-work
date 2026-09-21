import { store } from "./store.js";
import { heatmapReveal } from "./animations.js";
import { localDateKey } from "./date.js";

function levelFor(minutes) {
  if (!minutes) return 0;
  if (minutes < 25) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

export function renderProgress() {
  const { history } = store.get();
  const grid = document.querySelector("#heat-grid");
  const months = document.querySelector("#heat-months");
  if (!grid || !months) return;

  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  const lead = (jan1.getDay() + 6) % 7; // Monday-first
  const today = new Date();
  const dayCount = Math.round((new Date(year, 11, 31) - jan1) / 86400000) + 1;
  const WEEKS = Math.ceil((lead + dayCount) / 7);

  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthStartWeek = names.map((_, m) => {
    const offset = Math.round((new Date(year, m, 1) - jan1) / 86400000);
    return Math.floor((lead + offset) / 7);
  });

  grid.style.gridTemplateColumns = `repeat(${WEEKS}, var(--cell))`;
  months.style.gridTemplateColumns = `repeat(${WEEKS}, var(--cell))`;
  months.innerHTML = names
    .map((n, m) => {
      const span = (monthStartWeek[m + 1] ?? WEEKS) - monthStartWeek[m];
      return `<span style="grid-column: ${monthStartWeek[m] + 1} / span ${span}">${n}</span>`;
    })
    .join("");

  let html = "";
  for (let i = 0; i < lead; i++) html += `<i class="is-blank"></i>`;

  let totalMinutes = 0;
  let daysWithFocus = 0;
  let streak = 0;
  let runningStreak = 0;

  for (let d = 0; d < dayCount; d++) {
    const date = new Date(year, 0, 1 + d);
    const key = localDateKey(date);
    const minutes = history[key] || 0;

    if (date > today) {
      html += `<i class="is-future" data-lvl="0"></i>`;
      continue;
    }

    totalMinutes += minutes;
    if (minutes > 0) {
      daysWithFocus++;
      runningStreak++;
      streak = Math.max(streak, runningStreak);
    } else {
      runningStreak = 0;
    }

    html += `<i data-lvl="${levelFor(minutes)}"></i>`;
  }

  grid.innerHTML = html;

  const summary = document.querySelector("#summary");
  if (summary) {
    summary.querySelector('[data-stat="hours"]').textContent = (totalMinutes / 60).toFixed(1);
    summary.querySelector('[data-stat="days"]').textContent = daysWithFocus;
    summary.querySelector('[data-stat="streak"]').textContent = streak;
  }

  heatmapReveal(grid.querySelectorAll("i:not(.is-blank)"));
}
