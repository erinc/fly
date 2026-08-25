// src/ui/panel.ts

export type Panel = {
  el: HTMLElement;
  backdrop: HTMLButtonElement;
  trigger: HTMLButtonElement;
};

/** Fixed left rail on wide screens, full-height overlay drawer on mobile. */
export function createPanel(
  children: HTMLElement[],
  options: { initiallyOpen?: boolean } = {},
): Panel {
  const el = document.createElement("aside");
  el.className = "panel";
  el.id = "airports-panel";

  const drawerHeader = document.createElement("div");
  drawerHeader.className = "drawer-header";
  const drawerTitle = document.createElement("strong");
  drawerTitle.textContent = "Airports";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "panel-close";
  close.setAttribute("aria-label", "Close airports");
  close.textContent = "×";
  drawerHeader.append(drawerTitle, close);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "panel-trigger";
  trigger.setAttribute("aria-controls", el.id);
  trigger.setAttribute("aria-expanded", "false");
  trigger.textContent = "Airports";

  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "panel-backdrop";
  backdrop.setAttribute("aria-label", "Close airports");

  const mobile = window.matchMedia("(max-width: 760px)");
  let open = options.initiallyOpen ?? false;

  const sync = () => {
    const mobileClosed = mobile.matches && !open;
    el.classList.toggle("is-open", mobile.matches && open);
    backdrop.classList.toggle("is-visible", mobile.matches && open);
    trigger.hidden = !mobile.matches || open;
    trigger.setAttribute("aria-expanded", String(mobile.matches && open));
    el.inert = mobileClosed;
    if (mobileClosed) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
  };

  const setOpen = (next: boolean) => {
    open = next;
    sync();
    if (open) close.focus();
    else if (mobile.matches) trigger.focus();
  };

  trigger.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open && mobile.matches) setOpen(false);
  });
  mobile.addEventListener("change", sync);

  let startX = 0;
  let startY = 0;
  el.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
  });
  el.addEventListener("pointerup", (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (mobile.matches && dx < -56 && Math.abs(dx) > Math.abs(dy)) {
      setOpen(false);
    }
  });

  el.append(drawerHeader, ...children);
  sync();
  return { el, backdrop, trigger };
}
