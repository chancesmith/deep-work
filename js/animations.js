const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function fadeModeSwitch(els) {
  if (reduced) return;
  gsap.fromTo(
    els,
    { y: 14, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.7, ease: "power3.out", stagger: 0.06 }
  );
}

export function layoutSwitch(el) {
  if (reduced) return;
  gsap.fromTo(
    el,
    { scale: 0.97, opacity: 0.4 },
    { scale: 1, opacity: 1, duration: 0.55, ease: "power3.out", clearProps: "all" }
  );
}

export function sheetOpen(sheet) {
  if (reduced) return;
  gsap.fromTo(sheet, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
  gsap.fromTo(
    sheet.querySelector(".sheet__panel"),
    { y: 16, scale: 0.985, opacity: 0 },
    { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: "power3.out", clearProps: "all" }
  );
}

export function heatmapReveal(cells) {
  if (reduced) return;
  gsap.fromTo(
    cells,
    { opacity: 0, scale: 0.6 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      ease: "power2.out",
      stagger: { each: 0.0015, from: "start" },
      clearProps: "all",
    }
  );
}
