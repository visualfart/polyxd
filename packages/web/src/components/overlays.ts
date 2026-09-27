import { isBinding, menuOrder, type Node } from "@polyxd/core";
import { h, type Props, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Dialog, Menu, Popover, closedMenu, dialogClose, menuTrigger, type MenuItemSpec, type MenuState } from "../primitives.ts";
import { Children } from "./structure.ts";
import { Icon } from "./avatar.ts";

/** A downward chevron: the one glyph the icon set lacks. */
const Chevron = (): VNode => h("svg", { class: "pxd-action-menu-chevron", width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, h("path", { d: "m6 9 6 6 6-6" }));

/**
 * Secondary actions behind one control. The children are Actions; each becomes a menu item that
 * dispatches that Action. A danger-toned Action goes last, after a divider. `context` also renders
 * an overflow control, since right-click and long-press are not discoverable.
 */
export function ActionMenu(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const a11y = ctx.a11y(node);
  const kind: string = node.kind ?? "overflow";
  const label = b.text(node.label);
  // accessibility.label, when the author set one, wins over the control's own label.
  const name = (a11y["aria-label"] as string | undefined) ?? label;
  const id = ctx.id(node, "menu");
  const [menu, setMenu] = ctx.state<MenuState>(node, "menu", closedMenu);
  const [context, setContext] = ctx.state<MenuState>(node, "context", closedMenu);

  const actions: Node[] = (node.children ?? []).map((cid: string) => r.byId.get(cid)).filter((c: Node | undefined): c is Node => Boolean(c) && (c!.visible === undefined || b.value(c!.visible) !== false));
  const { usual, danger, divider } = menuOrder(actions);
  const item = (a: Node): MenuItemSpec => ({
    key: a.id,
    label: [b.text(a.label)],
    class: `pxd-menu-item${a.tone === "danger" ? " pxd-menu-item-danger" : ""}`,
    disabled: a.disabled !== undefined ? Boolean(b.value(a.disabled)) : undefined,
    onSelect: () => r.dispatch(a.action, b.scope, a.id),
    props: { "data-pxd-id": a.id, "data-pxd-component": a.component },
  });
  const items: (MenuItemSpec | "separator")[] = [...usual.map(item), ...(divider ? ["separator" as const] : []), ...danger.map(item)];
  Menu(ctx, id, menu, setMenu, items, { class: "pxd-menu pxd-action-menu" });

  const trigger = (props: Props, align: "start" | "end", ...children: VChild[]) => h("button", { type: "button", ...menuTrigger(id, menu, setMenu, align, props) }, ...children);
  const overflowTrigger = () => trigger({ class: "pxd-icon-button pxd-action-menu-trigger pxd-action-menu-overflow", ...a11y, "aria-label": name }, "end", Icon("dots", 18));

  if (kind === "dropdown") return trigger({ class: "pxd-button pxd-button-secondary pxd-action-menu-trigger pxd-action-menu-dropdown", ...a11y, "aria-label": a11y["aria-label"] as string | undefined }, "end", label, Chevron());

  if (kind === "split") {
    // The menu part takes the primary's emphasis so the two read as one control.
    const primary = node.primary ? r.byId.get(node.primary) : undefined;
    const emphasis = primary?.emphasis ?? "secondary";
    return h("div", { class: "pxd-split", role: "group", ...a11y, "aria-label": name }, node.primary && ctx.render(node.primary), trigger({ class: `pxd-button pxd-button-${emphasis} pxd-action-menu-trigger pxd-split-menu`, "aria-label": `${label}: more options` }, "end", Chevron()));
  }

  if (kind === "context") {
    // Right-click (or a long press) opens the same items where the pointer is.
    Menu(ctx, `${id}-context`, context, setContext, items, { class: "pxd-menu pxd-action-menu", "aria-label": name });
    return h(
      "span",
      {
        class: "pxd-context-target",
        "data-state": context.open ? "open" : "closed",
        style: { WebkitTouchCallout: "none" },
        onContextmenu: (e: MouseEvent) => {
          e.preventDefault();
          setContext({ open: true, x: e.clientX, y: e.clientY, align: "start" });
        },
      },
      overflowTrigger(),
    );
  }

  return overflowTrigger();
}

/**
 * Content over the current view. `open` may be bound to host data (the renderer writes false on
 * dismiss); absent, the panel is open until dismissed. Dismissal also dispatches ui.dismiss, like
 * Confirm. dialog, drawer and sheet are modal (a native dialog); popover is non-modal, anchored
 * where the Panel sits in the tree.
 */
export function Panel(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const r = ctx.r;
  const a11y = ctx.a11y(node);
  const level = Math.min(ctx.heading, 6);
  const titleId = ctx.id(node, "title");
  const id = ctx.id(node, "panel");
  const kind: string = node.kind ?? "dialog";
  const size: string = node.size ?? "default";
  const dismissible = node.dismissible !== false;
  const bound = isBinding(node.open);
  const [local, setLocal] = ctx.state<boolean>(node, "open", true);
  const open = bound ? Boolean(b.value(node.open)) : local && node.open !== false;

  const close = () => {
    if (bound) b.write(node.open as { path: string }, false);
    else setLocal(false);
    r.dispatch({ event: { name: "ui.dismiss" } }, b.scope, node.id);
  };
  const title = b.text(node.title);
  const className = `pxd-panel pxd-panel-${kind} pxd-panel-size-${size}`;
  const inner = ctx.with({ heading: level + 1 });
  const body = () => h("div", { class: "pxd-panel-body pxd-stack" }, ...Children(inner, node.children));
  const footer = () => node.actions && h("div", { class: "pxd-panel-footer" }, ctx.render(node.actions));

  if (kind === "popover") {
    if (open) {
      Popover(
        ctx,
        id,
        `.pxd-panel-anchor[data-pxd-anchor="${CSS.escape(node.id)}"]`,
        close,
        dismissible,
        { class: className, "aria-labelledby": titleId, ...a11y },
        h("div", { class: "pxd-panel-header" }, h(`h${level}`, { id: titleId, class: "pxd-panel-title" }, title), dismissible && h("button", { type: "button", class: "pxd-icon-button pxd-panel-close", "aria-label": "Close", onClick: close }, Icon("close"))),
        body(),
        footer(),
        h("span", { style: { position: "absolute", left: "50%", top: "100%", transform: "translateX(-50%)" } }, h("svg", { class: "pxd-panel-arrow", width: 16, height: 8, viewBox: "0 0 30 10", preserveAspectRatio: "none" }, h("polygon", { points: "0,0 30,0 15,10" }))),
      );
    }
    return h("span", { class: "pxd-panel-anchor", "data-pxd-anchor": node.id });
  }

  if (!open) return null;
  // Drag a bottom sheet down to dismiss it. Handlers go on the header; the transform on the sheet.
  const drag: Props = kind === "sheet" && dismissible ? sheetDrag(close) : {};
  ctx.portal(
    Dialog(
      { ctx, id, class: className, overlayClass: "pxd-overlay pxd-panel-backdrop", dismissible, onClose: close, props: { "aria-labelledby": titleId, ...a11y } },
      h("div", { class: "pxd-panel-header", ...drag }, kind === "sheet" && h("span", { class: "pxd-panel-grip", "aria-hidden": "true" }), h(`h${level}`, { id: titleId, class: "pxd-panel-title" }, title), dismissible && dialogClose(close, { class: "pxd-icon-button pxd-panel-close", "aria-label": "Close" }, Icon("close"))),
      body(),
      footer(),
    ),
  );
  return null;
}

function sheetDrag(onDismiss: () => void): Props {
  let start: number | null = null;
  const sheetOf = (e: Event) => (e.currentTarget as HTMLElement).closest<HTMLDialogElement>("dialog");
  const reset = (e: Event) => {
    start = null;
    const sheet = sheetOf(e);
    if (sheet) {
      sheet.style.transform = "";
      sheet.style.transition = "";
    }
  };
  return {
    onPointerdown: (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointermove: (e: PointerEvent) => {
      const sheet = sheetOf(e);
      if (start === null || !sheet) return;
      const dy = Math.max(0, e.clientY - start);
      sheet.style.transition = "none";
      sheet.style.transform = `translateY(${dy}px)`;
    },
    onPointerup: (e: PointerEvent) => {
      if (start === null) return;
      const dy = e.clientY - start;
      const sheet = sheetOf(e);
      reset(e);
      if (dy > 80) {
        if (sheet?.open) sheet.close();
        onDismiss();
      }
    },
    onPointercancel: reset,
  };
}
