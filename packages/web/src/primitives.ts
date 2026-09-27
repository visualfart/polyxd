/**
 * The interactive primitives Radix gives the React renderer, written for the DOM: the same roles,
 * names, states and keyboard handling, so a document reads and operates the same in both.
 */
import { h, type VChild, type VNode, type Props } from "./dom.ts";
import type { Ctx } from "./renderer.ts";
import type { Node } from "@polyxd/core";

type Handler<E extends Event> = (e: E) => void;
const isEditable = (el: EventTarget | null): boolean => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/* ---- Checkbox: a button that is checked, unchecked or mixed. ---- */

export function Checkbox(props: Props & { checked: boolean | "indeterminate"; onCheckedChange: (checked: boolean) => void; indicator?: VChild }, ...children: VChild[]): VNode {
  const { checked, onCheckedChange, indicator, ...rest } = props;
  const state = checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";
  return h(
    "button",
    { type: "button", role: "checkbox", "aria-checked": checked === "indeterminate" ? "mixed" : checked, "data-state": state, value: "on", ...rest, onClick: () => onCheckedChange(checked === "indeterminate" ? true : !checked) },
    state !== "unchecked" ? indicator : null,
    ...children,
  );
}

/* ---- Radio group: one button per option, arrows move and choose (roving tabindex). ---- */

export interface RadioGroupProps extends Props {
  value: string;
  onValueChange: (value: string) => void;
  orientation?: "horizontal" | "vertical";
}

/** The group carries the roving focus: Tab lands on it and it hands focus to the chosen item, or the first. */
export function RadioGroup(props: RadioGroupProps, ...children: VChild[]): VNode {
  const { value, onValueChange, orientation, ...rest } = props;
  const onKeyDown: Handler<KeyboardEvent> = (e) => {
    const group = e.currentTarget as HTMLElement;
    const items = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0 || !items.length) return;
    const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!forward && !back) return;
    e.preventDefault();
    const next = items[(i + (forward ? 1 : items.length - 1)) % items.length];
    next.focus();
    next.click();
  };
  const onFocus: Handler<FocusEvent> = (e) => {
    const group = e.currentTarget as HTMLElement;
    if (e.target !== group) return;
    const items = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
    (items.find((b) => b.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
  };
  return h(
    "div",
    { role: "radiogroup", "aria-orientation": orientation, dir: "ltr", tabindex: "0", style: { outline: "none" }, ...rest, "data-value": value, onKeydown: onKeyDown, onFocus, onFocusin: (e: FocusEvent) => ((e.currentTarget as HTMLElement).tabIndex = -1), onFocusout: (e: FocusEvent) => {
      const g = e.currentTarget as HTMLElement;
      if (!g.contains(e.relatedTarget as globalThis.Node | null)) g.tabIndex = 0;
    } },
    ...children,
  );
}

/** One option. `group` is the group's value; the checked item (or the first, when none is) takes the tab stop. */
export function RadioItem(props: Props & { value: string; group: string; first?: boolean; onSelect: () => void; indicator?: VChild }, ...children: VChild[]): VNode {
  const { value, group, first, onSelect, indicator, ...rest } = props;
  const checked = group === value;
  const tabbable = checked || (group === "" && first);
  return h(
    "button",
    { type: "button", role: "radio", "aria-checked": checked, "data-state": checked ? "checked" : "unchecked", value, tabindex: tabbable ? "0" : "-1", ...rest, onClick: () => !checked && onSelect() },
    checked ? indicator : null,
    ...children,
  );
}

/* ---- Switch ---- */

export function Switch(props: Props & { checked: boolean; onCheckedChange: (checked: boolean) => void }): VNode {
  const { checked, onCheckedChange, ...rest } = props;
  const state = checked ? "checked" : "unchecked";
  return h("button", { type: "button", role: "switch", "aria-checked": checked, "data-state": state, value: "on", ...rest, onClick: () => onCheckedChange(!checked) }, h("span", { "data-state": state, class: "pxd-switch-thumb" }));
}

/* ---- Slider: one or two thumbs on a track; arrows, Home/End and the pointer move them. ---- */

export interface SliderProps {
  min: number;
  max: number;
  step: number;
  values: number[];
  onValueChange: (values: number[]) => void;
  thumbs: { "aria-label"?: string; "aria-labelledby"?: string; "aria-valuetext": string }[];
  /** With two thumbs, they never cross: at least this many steps apart */
  minStepsBetweenThumbs?: number;
}

const THUMB_PX = 20;

export function Slider(p: SliderProps): VNode {
  const { min, max, step } = p;
  const span = max - min || 1;
  const pct = (v: number) => ((v - min) / span) * 100;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => clamp(min + Math.round((v - min) / step) * step);
  const set = (i: number, v: number) => {
    const next = [...p.values];
    next[i] = snap(v);
    const gap = (p.minStepsBetweenThumbs ?? 0) * step;
    if (next.length === 2) {
      if (i === 0) next[0] = Math.min(next[0], next[1] - gap);
      else next[1] = Math.max(next[1], next[0] + gap);
    }
    p.onValueChange(next);
  };
  const onKeyDown = (i: number) => (e: KeyboardEvent) => {
    const v = p.values[i];
    const big = step * 10;
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? v + step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? v - step : e.key === "PageUp" ? v + big : e.key === "PageDown" ? v - big : e.key === "Home" ? min : e.key === "End" ? max : undefined;
    if (next === undefined) return;
    e.preventDefault();
    set(i, next);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const root = e.currentTarget as HTMLElement;
    const track = root.querySelector<HTMLElement>(".pxd-slider-track")!;
    const valueAt = (x: number) => {
      const r = track.getBoundingClientRect();
      return min + Math.min(1, Math.max(0, (x - r.left) / (r.width || 1))) * span;
    };
    // The nearest thumb follows the pointer.
    const v = valueAt(e.clientX);
    let i = 0;
    p.values.forEach((tv, ti) => {
      if (Math.abs(tv - v) < Math.abs(p.values[i] - v)) i = ti;
    });
    e.preventDefault();
    root.querySelectorAll<HTMLElement>('[role="slider"]')[i]?.focus();
    set(i, v);
    const move = (ev: PointerEvent) => set(i, valueAt(ev.clientX));
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };
  const lo = pct(p.values[0]);
  const hi = pct(p.values[p.values.length - 1]);
  const range = p.values.length === 1 ? { left: "0%", right: `${100 - hi}%` } : { left: `${lo}%`, right: `${100 - hi}%` };
  // The thumb stays inside the track: at 0% it is offset by half its width, at 100% by minus half.
  const offset = (percent: number) => THUMB_PX / 2 - (percent / 50) * (THUMB_PX / 2);
  return h(
    "span",
    { dir: "ltr", "data-orientation": "horizontal", class: "pxd-slider", style: { "--radix-slider-thumb-transform": "translateX(-50%)" }, onPointerdown: onPointerDown },
    h("span", { "data-orientation": "horizontal", class: "pxd-slider-track" }, h("span", { "data-orientation": "horizontal", class: "pxd-slider-range", style: range })),
    ...p.values.map((v, i) =>
      h(
        "span",
        { key: i, style: { transform: "var(--radix-slider-thumb-transform)", position: "absolute", left: `calc(${pct(v)}% + ${offset(pct(v))}px)` } },
        h("span", {
          role: "slider",
          "aria-label": p.thumbs[i]?.["aria-label"],
          "aria-labelledby": p.thumbs[i]?.["aria-labelledby"],
          "aria-valuemin": min,
          "aria-valuenow": v,
          "aria-valuemax": max,
          "aria-valuetext": p.thumbs[i]?.["aria-valuetext"],
          "aria-orientation": "horizontal",
          "data-orientation": "horizontal",
          tabindex: "0",
          class: "pxd-slider-thumb",
          onKeydown: onKeyDown(i),
        }),
      ),
    ),
  );
}

/* ---- Tabs ---- */

export interface TabsProps {
  id: string;
  value: string;
  onValueChange: (key: string) => void;
  tabs: { key: string; label: VChild[]; content: VChild }[];
  rootClass: string;
  listClass: string;
  tabClass: string;
  panelClass: string;
  rootProps?: Props;
}

/** Arrows move between tabs and select them (automatic activation), as Radix does. */
export function Tabs(p: TabsProps): VNode {
  const onKeyDown = (e: KeyboardEvent) => {
    const list = e.currentTarget as HTMLElement;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };
  return h(
    "div",
    { dir: "ltr", "data-orientation": "horizontal", class: p.rootClass, ...(p.rootProps ?? {}) },
    h(
      "div",
      { role: "tablist", "aria-orientation": "horizontal", class: p.listClass, tabindex: "-1", "data-orientation": "horizontal", style: { outline: "none" }, onKeydown: onKeyDown },
      ...p.tabs.map((t) => {
        const on = t.key === p.value;
        return h(
          "button",
          { key: t.key, type: "button", role: "tab", "aria-selected": on, "aria-controls": `${p.id}-content-${t.key}`, "data-state": on ? "active" : "inactive", id: `${p.id}-trigger-${t.key}`, tabindex: on ? "0" : "-1", "data-orientation": "horizontal", class: p.tabClass, onClick: () => p.onValueChange(t.key) },
          ...t.label,
        );
      }),
    ),
    ...p.tabs.map((t) => {
      const on = t.key === p.value;
      return h("div", { key: t.key, "data-state": on ? "active" : "inactive", "data-orientation": "horizontal", role: "tabpanel", "aria-labelledby": `${p.id}-trigger-${t.key}`, id: `${p.id}-content-${t.key}`, tabindex: "0", class: p.panelClass, hidden: !on, style: { animationDuration: "0s" } }, on ? t.content : null);
    }),
  );
}

/* ---- Modal dialogs: a native <dialog>, shown modally, over the surface's scrim. ---- */

export interface DialogProps {
  ctx: Ctx;
  /** A key for the dialog's state, unique in the surface */
  id: string;
  role?: "dialog" | "alertdialog";
  class: string;
  overlayClass?: string;
  /** Escape and the backdrop close it, unless it must be completed */
  dismissible?: boolean;
  onClose: () => void;
  props?: Props;
  /** Called with the element once it is open, so a sheet may attach its drag handlers */
  ref?: (el: HTMLDialogElement | null) => void;
}

/**
 * Opens on mount with showModal(), which traps focus, makes the rest inert and returns focus on
 * close. Like Radix's hideOthers, the surface's other regions are hidden from assistive technology
 * while it is open (the renderer sets aria-hidden on them for every modal in the portal).
 */
export function Dialog(p: DialogProps, ...children: VChild[]): VChild {
  const dismissible = p.dismissible !== false;
  p.ctx.r.modals++;
  const ref = (el: Element | null) => {
    const d = el as HTMLDialogElement | null;
    if (d && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute("open", "");
      }
    }
    p.ref?.(d);
  };
  const close = (d: HTMLDialogElement) => {
    // close() first, so focus returns to what opened it before the element goes.
    if (d.open) d.close();
    p.onClose();
  };
  return [
    h("div", { key: `${p.id}-overlay`, "data-state": "open", class: p.overlayClass ?? "pxd-overlay", "aria-hidden": "true", style: { pointerEvents: "auto" } }),
    h(
      "dialog",
      {
        key: p.id,
        role: p.role ?? "dialog",
        "data-state": "open",
        class: p.class,
        tabindex: "-1",
        "data-pxd-modal": "",
        ...(p.props ?? {}),
        ref,
        onCancel: (e: Event) => {
          e.preventDefault();
          if (dismissible) close(e.currentTarget as HTMLDialogElement);
        },
        onClick: (e: MouseEvent) => {
          // A click on the backdrop lands on the dialog element itself, outside its box.
          const d = e.currentTarget as HTMLDialogElement;
          if (e.target !== d) return;
          const r = d.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside && dismissible) close(d);
        },
        onClose: () => p.onClose(),
      },
      ...children,
    ),
  ];
}

/** A dialog's close control: a button that closes it, named "Close" unless told otherwise. */
export const dialogClose = (onClose: () => void, props: Props, ...children: VChild[]): VNode =>
  h("button", { type: "button", ...props, onClick: (e: Event) => {
    const d = (e.currentTarget as HTMLElement).closest("dialog");
    if (d?.open) d.close();
    onClose();
  } }, ...children);

/* ---- Menus: a trigger and a list of items, positioned by the trigger, driven by the arrow keys. ---- */

export interface MenuState {
  open: boolean;
  /** Where to put it: below the trigger, or at the pointer for a context menu */
  x: number;
  y: number;
  /** Whether it was opened from the keyboard, in which case the first item takes focus */
  keyboard?: boolean;
  align: "start" | "end";
}

export const closedMenu = (): MenuState => ({ open: false, x: 0, y: 0, align: "end" });

export interface MenuItemSpec {
  key: string;
  label: VChild[];
  class: string;
  disabled?: boolean;
  onSelect: () => void;
  props?: Props;
}

/** The trigger's props: what it is, whether it is open, and how to open it. */
export function menuTrigger(id: string, state: MenuState, setState: (s: MenuState) => void, align: "start" | "end", props: Props): Props {
  const open = (el: HTMLElement, keyboard: boolean) => {
    const r = el.getBoundingClientRect();
    setState({ open: true, x: align === "end" ? r.right : r.left, y: r.bottom + 4, keyboard, align });
  };
  return {
    id: `${id}-trigger`,
    "aria-haspopup": "menu",
    "aria-expanded": state.open,
    "aria-controls": state.open ? `${id}-content` : undefined,
    "data-state": state.open ? "open" : "closed",
    ...props,
    onPointerdown: (e: PointerEvent) => {
      if (e.button !== 0 || e.ctrlKey) return;
      e.preventDefault();
      if (state.open) setState(closedMenu());
      else open(e.currentTarget as HTMLElement, false);
    },
    onKeydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        open(e.currentTarget as HTMLElement, true);
      }
    },
  };
}

/** The menu itself, rendered into the portal while open. Escape and selection return focus to the trigger. */
export function Menu(ctx: Ctx, id: string, state: MenuState, setState: (s: MenuState) => void, items: (MenuItemSpec | "separator")[], props: Props): void {
  if (!state.open) return;
  const close = (refocus = true) => {
    setState(closedMenu());
    if (refocus) (document.getElementById(`${id}-trigger`) ?? ctx.r.root?.querySelector<HTMLElement>(`[data-pxd-menu-trigger="${id}"]`))?.focus();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const menu = e.currentTarget as HTMLElement;
    const all = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([data-disabled])'));
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") return (e.preventDefault(), close());
    if (e.key === "Tab") return close(false);
    const next = e.key === "ArrowDown" ? (i + 1) % all.length : e.key === "ArrowUp" ? (i + all.length - 1) % all.length : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : -1;
    if (next >= 0 && all.length) (e.preventDefault(), all[next].focus());
  };
  let outside: ((e: Event) => void) | null = null;
  const ref = (el: Element | null) => {
    if (!el) {
      if (outside) document.removeEventListener("pointerdown", outside, true);
      outside = null;
      return;
    }
    const menu = el as HTMLElement;
    // Clamp within the viewport, then focus the menu (or its first item when opened from the keyboard).
    const r = menu.getBoundingClientRect();
    const wrapper = menu.parentElement as HTMLElement;
    const x = state.align === "end" ? Math.max(8, state.x - r.width) : Math.min(state.x, window.innerWidth - r.width - 8);
    const y = state.y + r.height > window.innerHeight ? Math.max(8, state.y - r.height - 8) : state.y;
    wrapper.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    const first = menu.querySelector<HTMLElement>('[role="menuitem"]:not([data-disabled])');
    (state.keyboard && first ? first : menu).focus({ preventScroll: true });
    outside = (e: Event) => {
      if (!menu.contains(e.target as globalThis.Node) && !(e.target as HTMLElement).closest?.(`#${CSS.escape(`${id}-trigger`)}`)) close(false);
    };
    document.addEventListener("pointerdown", outside, true);
  };
  ctx.portal(
    h(
      "div",
      { key: `${id}-menu`, "data-radix-popper-content-wrapper": "", style: { position: "fixed", left: "0px", top: "0px", minWidth: "max-content", zIndex: 12 } },
      h(
        "div",
        { role: "menu", "aria-orientation": "vertical", "data-state": "open", dir: "ltr", id: `${id}-content`, "aria-labelledby": `${id}-trigger`, tabindex: "-1", style: { outline: "none" }, ...props, ref, onKeydown: onKeyDown },
        ...items.map((it, i) =>
          it === "separator"
            ? h("div", { key: `sep-${i}`, role: "separator", "aria-orientation": "horizontal", class: "pxd-menu-separator" })
            : h(
                "div",
                {
                  key: it.key,
                  role: "menuitem",
                  class: it.class,
                  tabindex: "-1",
                  "data-orientation": "vertical",
                  "aria-disabled": it.disabled || undefined,
                  "data-disabled": it.disabled ? "" : undefined,
                  ...(it.props ?? {}),
                  onPointermove: (e: PointerEvent) => {
                    (e.currentTarget as HTMLElement).focus();
                  },
                  onFocus: (e: FocusEvent) => {
                    for (const o of (e.currentTarget as HTMLElement).parentElement!.querySelectorAll('[data-highlighted]')) o.removeAttribute("data-highlighted");
                    (e.currentTarget as HTMLElement).setAttribute("data-highlighted", "");
                  },
                  onBlur: (e: FocusEvent) => (e.currentTarget as HTMLElement).removeAttribute("data-highlighted"),
                  onClick: () => {
                    if (it.disabled) return;
                    close();
                    it.onSelect();
                  },
                  onKeydown: (e: KeyboardEvent) => {
                    if ((e.key === "Enter" || e.key === " ") && !it.disabled) (e.preventDefault(), close(), it.onSelect());
                  },
                },
                ...it.label,
              ),
        ),
      ),
    ),
  );
}

/* ---- Popover: non-modal content beside an anchor, dismissed by Escape or a click outside. ---- */

export function Popover(ctx: Ctx, id: string, anchorSelector: string, onClose: () => void, dismissible: boolean, props: Props, ...children: VChild[]): void {
  let outside: ((e: Event) => void) | null = null;
  let keys: ((e: KeyboardEvent) => void) | null = null;
  const ref = (el: Element | null) => {
    if (!el) {
      if (outside) document.removeEventListener("pointerdown", outside, true);
      if (keys) document.removeEventListener("keydown", keys);
      outside = keys = null;
      return;
    }
    const content = el as HTMLElement;
    const wrapper = content.parentElement as HTMLElement;
    const anchor = ctx.r.root?.querySelector<HTMLElement>(anchorSelector);
    const a = anchor?.getBoundingClientRect() ?? { left: 8, bottom: 8, width: 0 };
    const r = content.getBoundingClientRect();
    const x = Math.max(8, Math.min(a.left + a.width / 2 - r.width / 2, window.innerWidth - r.width - 8));
    const y = a.bottom + 8 + r.height > window.innerHeight ? Math.max(8, (anchor?.getBoundingClientRect().top ?? 0) - 8 - r.height) : a.bottom + 8;
    wrapper.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    (content.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? content).focus({ preventScroll: true });
    if (!dismissible) return;
    outside = (e: Event) => {
      if (!content.contains(e.target as globalThis.Node)) onClose();
    };
    keys = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keys);
  };
  ctx.portal(
    h(
      "div",
      { key: `${id}-popover`, "data-radix-popper-content-wrapper": "", style: { position: "fixed", left: "0px", top: "0px", minWidth: "max-content", zIndex: 12 } },
      h("div", { "data-side": "bottom", "data-align": "center", "data-state": "open", role: "dialog", id: `${id}-content`, tabindex: "-1", ...props, ref }, ...children),
    ),
  );
}

/* ---- Keyboard shortcuts on the document, scoped to the surface. ---- */

export { isEditable };
export type { Node };
