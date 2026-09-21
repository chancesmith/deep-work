// History is keyed by calendar day, and that day has to be the user's *local*
// day. `toISOString()` returns the UTC date, so anyone west of UTC filing an
// evening session got it recorded against tomorrow — e.g. 9pm in US Central is
// already the next day in UTC, which skewed "min today" and the year heatmap.
export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
