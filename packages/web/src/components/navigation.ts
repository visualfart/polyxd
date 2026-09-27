import { BAR_MAX, NAV_COMPACT_PX, groupItems, navigationLabel, type Node } from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Dialog, dialogClose } from "../primitives.ts";
import { Icon } from "./avatar.ts";

/**
 * Navigation: the product's sections. A side navigation on wide surfaces (grouped, with the
 * current item marked), a menu button that opens them on compact ones. The other kinds sit in
 * the page: a breadcrumb trail, expandable groups, a table of contents, or section tabs.
 * Inside a Frame, the frame's own main navigation takes the placement the frame decided.
 */
export function Navigation(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const r = ctx.r;
  const frame = ctx.frame;
  const [compact, setCompact] = ctx.state<boolean>(node, "compact", false);
  const [open, setOpen] = ctx.state<boolean>(node, "open", false);
  const [toggled, setToggled] = ctx.state<Record<string, boolean>>(node, "toggled", () => ({}));
  const kind: string = node.kind ?? "main";
  const placed = frame && frame.navigationId === node.id && kind === "main" ? frame.navigation : undefined;
  // The host marks the current item through the frame; otherwise the binding says.
  const bound = b.value<string>(node.current);
  const current = placed && frame?.current?.key !== undefined ? frame.current.key : bound;
  const label = node.label !== undefined ? b.text(node.label) : navigationLabel(kind);
  const a11y = ctx.a11y(node);
  const drawerId = ctx.id(node, "drawer");

  const activate = (item: any) => {
    setOpen(false);
    frame?.setDrawerOpen(false);
    r.dispatch(item.action, b.scope, node.id);
  };
  const badgeOf = (item: any) => {
    const badge = item.badge !== undefined ? b.value<number>(item.badge) : undefined;
    return badge ? h("span", { class: "pxd-nav-badge" }, badge, h("span", { class: "pxd-sr-only" }, " needing attention")) : null;
  };

  if (kind === "breadcrumb") {
    // An ordered trail; the last item is where you are.
    return h(
      "nav",
      { class: "pxd-nav-breadcrumb", "aria-label": label, ...a11y },
      h(
        "ol",
        null,
        ...node.items.map((item: any, i: number) => {
          const last = i === node.items.length - 1;
          const on = item.key === current || (current === undefined && last);
          return h("li", { key: item.key }, on ? h("span", { class: "pxd-nav-breadcrumb-current", "aria-current": "page" }, b.text(item.label)) : h("button", { type: "button", class: "pxd-link", onClick: () => activate(item) }, b.text(item.label)));
        }),
      ),
    );
  }

  if (kind === "toc") {
    // Anchors to the page's sections, named by their keys; the section in view is marked.
    return h(
      "nav",
      { class: "pxd-nav-toc", "aria-label": label, ...a11y },
      h("p", { class: "pxd-nav-toc-label", "aria-hidden": "true" }, label),
      h(
        "ol",
        null,
        ...node.items.map((item: any) => {
          const on = item.key === current;
          return h("li", { key: item.key }, h("a", { href: `#${item.key}`, class: `pxd-nav-toc-link${on ? " pxd-nav-current" : ""}`, "aria-current": on ? "true" : undefined, onClick: () => r.dispatch(item.action, b.scope, node.id) }, b.text(item.label)));
        }),
      ),
    );
  }

  if (kind === "local") {
    // Sections of one area, as tabs.
    return h(
      "nav",
      { class: "pxd-nav-local", "aria-label": label, ...a11y },
      h(
        "ul",
        null,
        ...node.items.map((item: any) => {
          const on = item.key === current;
          return h("li", { key: item.key }, h("button", { type: "button", class: `pxd-nav-local-item${on ? " pxd-nav-current" : ""}`, "aria-current": on ? "page" : undefined, onClick: () => activate(item) }, item.icon && Icon(item.icon, 16), h("span", { class: "pxd-nav-label" }, b.text(item.label)), badgeOf(item)));
        }),
      ),
    );
  }

  const groups = groupItems<any>(node.items, b.text);
  const nested = kind === "nested";
  const isOpen = (g: { label?: string; items: any[] }) => (g.label && g.label in toggled ? toggled[g.label] : !g.label || g.items.some((item) => item.key === current));

  const items = (list: any[]) =>
    h(
      "ul",
      null,
      ...list.map((item: any) => {
        const on = item.key === current;
        return h("li", { key: item.key }, h("button", { type: "button", class: `pxd-nav-item${on ? " pxd-nav-current" : ""}`, "aria-current": on ? "page" : undefined, onClick: () => activate(item) }, item.icon && Icon(item.icon, 18), h("span", { class: "pxd-nav-label" }, b.text(item.label)), badgeOf(item)));
      }),
    );

  const list = h(
    "nav",
    { class: `pxd-nav${nested ? " pxd-nav-nested" : ""}${placed === "side" ? " pxd-nav-side" : ""}`, "aria-label": label, ...(placed === "side" ? a11y : {}) },
    ...groups.map((g, gi) =>
      h(
        "div",
        { class: "pxd-nav-group", key: gi },
        g.label && (nested ? h("button", { type: "button", class: "pxd-nav-group-toggle", "aria-expanded": isOpen(g), onClick: () => setToggled({ ...toggled, [g.label!]: !isOpen(g) }) }, Icon(isOpen(g) ? "sortUp" : "sortDown", 16), h("span", { class: "pxd-nav-group-label" }, g.label)) : h("p", { class: "pxd-nav-group-label" }, g.label)),
        (!nested || isOpen(g)) && items(g.items),
      ),
    ),
  );

  if (placed === "side") return list;

  if (placed === "rail" || placed === "bar") {
    // Icon over label, the current item marked, the badge on the icon. Groups don't fit; a bar shows five at most.
    const shown = placed === "bar" ? node.items.slice(0, BAR_MAX) : node.items;
    return h(
      "nav",
      { class: `pxd-nav-${placed}`, "aria-label": label, ...a11y },
      h(
        "ul",
        null,
        ...shown.map((item: any) => {
          const on = item.key === current;
          const text = b.text(item.label);
          return h(
            "li",
            { key: item.key },
            h(
              "button",
              { type: "button", class: `pxd-nav-${placed}-item${on ? " pxd-nav-current" : ""}`, "aria-current": on ? "page" : undefined, onClick: () => activate(item) },
              h("span", { class: `pxd-nav-${placed}-icon` }, item.icon ? Icon(item.icon, 24) : h("span", { class: "pxd-nav-glyph", "aria-hidden": "true" }, text.slice(0, 1)), badgeOf(item)),
              h("span", { class: "pxd-nav-label" }, text),
            ),
          );
        }),
      ),
    );
  }

  const drawer = (isOpen: boolean, close: () => void, props: Record<string, unknown>) => {
    if (!isOpen) return;
    const titleId = ctx.id(node, "drawer-title");
    ctx.portal(
      Dialog(
        { ctx, id: drawerId, class: "pxd-nav-drawer", onClose: close, props: { id: drawerId, "aria-labelledby": titleId, ...props } },
        h("div", { class: "pxd-sheet-header" }, h("h2", { id: titleId, class: "pxd-sheet-title" }, label), dialogClose(close, { class: "pxd-icon-button", "aria-label": "Close" }, Icon("close"))),
        list,
      ),
    );
  };

  if (placed === "drawer" && frame) {
    // The AppBar's menu button opens it; the Frame holds the state so the button can report it.
    drawer(frame.drawerOpen, () => frame.setDrawerOpen(false), a11y);
    return null;
  }

  drawer(compact && open, () => setOpen(false), {});
  return h(
    "div",
    {
      class: "pxd-nav-wrap",
      ...a11y,
      ref: (el: Element | null) => {
        if (!el || kind !== "main" || placed) return;
        const measured = el.closest(".pxd-surface") ?? el;
        r.observeWidth(measured, `${node.id}:nav`, (w) => setCompact(w < NAV_COMPACT_PX));
      },
    },
    compact ? h("button", { type: "button", class: "pxd-icon-button pxd-nav-menu", "aria-label": `${label} menu`, "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": open ? drawerId : undefined, "data-state": open ? "open" : "closed", onClick: () => setOpen(true) }, Icon("menu")) : list,
  );
}

export type { VNode };
