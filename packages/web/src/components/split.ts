import { SHARE_MAX, SHARE_MIN, initialSplit, splitPanes, splitReducer, splitSelection, type Node, type SplitState } from "@polyxd/core";
import { h, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Icon } from "./avatar.ts";

/**
 * Master and detail: the same panes, at the same widths, as the React Split (core decides). The
 * list stays mounted throughout, keeping its scroll position and selection.
 */
export function Split(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const [state, setState] = ctx.state<SplitState>(node, "split", () => initialSplit(node.ratio));
  const [previous, setPrevious] = ctx.state<unknown>(node, "previous", () => b.value(node.selected));
  const selected = b.value<unknown>(node.selected);
  const { has, scope, name } = splitSelection(node, ctx.r.byId, ctx.r.data, b.scope);
  const dispatch = (action: Parameters<typeof splitReducer>[1]) => setState((s) => splitReducer(s, action));

  // A new selection shows its detail; on compact it takes the screen and focus.
  let focusDetail = false;
  if (selected !== previous) {
    setPrevious(selected);
    if (state.listShown) dispatch({ type: "selected" });
    focusDetail = state.compact && has;
  }
  const { showList, showDetail } = splitPanes(state, has);

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const handle = e.currentTarget as HTMLElement;
    const el = handle.parentElement as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const move = (ev: PointerEvent) => {
      const x = rtl ? rect.right - ev.clientX : ev.clientX - rect.left;
      dispatch({ type: "share", value: (x / rect.width) * 100 });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };

  const resizable = Boolean(node.resizable) && !state.compact;
  const ref = (el: Element | null) => {
    if (!el) return;
    // Measured on the surface, the way the React Split does, so both stack at the same width.
    const measured = el.closest(".pxd-surface") ?? el;
    ctx.r.observeWidth(measured, `${node.id}:split`, (w) => dispatch({ type: "measure", width: w }));
  };
  if (focusDetail) ctx.after(() => ctx.r.root?.querySelector<HTMLElement>(`[data-pxd-id="${node.id}"] > .pxd-split-detail`)?.focus());
  return h(
    "div",
    { class: `pxd-split pxd-split-${node.ratio ?? "narrow"}${state.compact ? " pxd-split-compact" : ""}${resizable ? " pxd-split-resizable" : ""}`, style: resizable ? { "--polyxd-split-share": `${state.share}%` } : undefined, ...ctx.a11y(node), ref },
    h("div", { class: "pxd-split-primary", hidden: !showList }, ctx.render(node.primary)),
    resizable &&
      h(
        "div",
        {
          role: "separator",
          "aria-orientation": "vertical",
          "aria-label": "Resize the list",
          "aria-valuenow": Math.round(state.share),
          "aria-valuemin": SHARE_MIN,
          "aria-valuemax": SHARE_MAX,
          tabindex: "0",
          class: "pxd-split-handle",
          onKeydown: (e: KeyboardEvent) => {
            const next = splitReducer(state, { type: "key", key: e.key, shift: e.shiftKey });
            if (next === state) return;
            e.preventDefault();
            setState(next);
          },
          onPointerdown: onPointerDown,
        },
        h("span", { class: "pxd-split-handle-line", "aria-hidden": "true" }),
      ),
    showDetail &&
      h(
        "div",
        { class: "pxd-split-detail", tabindex: "-1", "aria-label": name },
        state.compact && h("button", { type: "button", class: "pxd-button pxd-button-tertiary pxd-split-back", onClick: () => dispatch({ type: "back" }) }, Icon("chevronLeft", 18), "Back"),
        has ? ctx.render(node.detail, scope) : node.empty ? ctx.render(node.empty) : null,
      ),
    h("span", { class: "pxd-sr-only", "aria-live": "polite" }, state.compact && has && !state.listShown ? name : ""),
  );
}
