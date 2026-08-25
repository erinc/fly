// src/ui/panel.ts

/**
 * One component, two presentations: a fixed left rail on wide viewports and a
 * draggable two-snap bottom sheet on narrow ones. The snap state is a class on
 * the element; the media query decides whether it means anything.
 */
export function createPanel(children: HTMLElement[]): HTMLElement {
  const el = document.createElement("aside");
  el.className = "panel snap-low";

  const grab = document.createElement("div");
  grab.className = "grab";
  grab.setAttribute("role", "button");
  grab.setAttribute("aria-label", "Expand or collapse the panel");
  grab.tabIndex = 0;

  const toggle = () => el.classList.toggle("snap-high");
  grab.addEventListener("click", toggle);
  grab.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { toggle(); e.preventDefault(); }
  });

  let startY = 0;
  grab.addEventListener("pointerdown", (e) => { startY = e.clientY; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener("pointerup", (e) => {
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 24) el.classList.toggle("snap-high", dy < 0);
  });

  el.append(grab, ...children);
  return el;
}
