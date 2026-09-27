import { formatCount, formatPercent, selectedView } from "@polyxd/core";
import type { Node } from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Tabs } from "../primitives.ts";

export const Children = (ctx: Ctx, ids?: string[]): VChild[] => (ids ?? []).map((id) => ctx.render(id));

export function Heading(ctx: Ctx, className: string | undefined, ...children: VChild[]): VNode {
  return h(`h${Math.min(ctx.heading, 6)}`, { class: className }, ...children);
}

export function Section(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const headingId = ctx.id(node, "heading");
  return h(
    "section",
    { class: "pxd-section", "aria-labelledby": headingId, ...ctx.a11y(node) },
    h("div", { class: "pxd-section-header" }, h(`h${Math.min(ctx.heading, 6)}`, { id: headingId, class: "pxd-section-title" }, b.text(node.title)), node.description !== undefined && h("p", { class: "pxd-section-description" }, b.text(node.description))),
    h("div", { class: "pxd-stack" }, ...Children(ctx.with({ heading: ctx.heading + 1 }), node.children)),
  );
}

export function Group(node: Node, ctx: Ctx): VNode {
  // A group of numbers reads as one strip of tiles, not a stack of blocks.
  const children = (node.children ?? []).map((id: string) => ctx.r.byId.get(id));
  const metrics = children.length > 1 && children.every((c: Node | undefined) => c?.component === "Metric");
  // 'inline' and 'grid' are the author's call; 'auto' (the default) stacks, except a row of numbers.
  const arrangement: string = node.arrangement ?? "auto";
  const cls = arrangement === "inline" ? " pxd-group-inline" : arrangement === "grid" ? " pxd-group-grid" : metrics ? " pxd-metric-row" : "";
  return h("div", { class: `pxd-group pxd-stack${cls}`, ...ctx.a11y(node) }, ...Children(ctx, node.children));
}

/** Side-by-side columns, one child each, that stack below the collapse width (the stylesheet collapses them). */
export function Columns(node: Node, ctx: Ctx): VNode {
  return h("div", { class: `pxd-columns pxd-columns-${node.layout ?? "two-thirds"} pxd-columns-collapse-${node.collapse ?? "compact"} pxd-columns-align-${node.align ?? "stretch"}`, ...ctx.a11y(node) }, ...Children(ctx, node.children));
}

export function Card(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const title = b.text(node.title);
  const badgeTone = node.badge?.tone ?? "neutral";
  return h(
    "article",
    { class: `pxd-card${node.action ? " pxd-card-actionable" : ""}`, ...ctx.a11y(node) },
    node.media && h("div", { class: "pxd-card-media" }, ctx.render(node.media)),
    h(
      "div",
      { class: "pxd-card-body" },
      h(
        "div",
        { class: "pxd-card-header" },
        // Stretched button: the whole card is one target, named by its title.
        Heading(ctx, "pxd-card-title", node.action ? h("button", { type: "button", class: "pxd-card-link", onClick: () => ctx.r.dispatch(node.action, b.scope, node.id) }, title) : title),
        node.badge && h("span", { class: `pxd-badge pxd-tone-${badgeTone}` }, b.text(node.badge.text)),
      ),
      node.subtitle !== undefined && h("p", { class: "pxd-card-subtitle" }, b.text(node.subtitle)),
      node.progress && CardProgress(b.value(node.progress.value), (node.progress.label !== undefined && b.text(node.progress.label)) || undefined, title, ctx.r.locale),
      node.children && h("div", { class: "pxd-stack pxd-stack-tight pxd-card-children" }, ...Children(ctx, node.children)),
    ),
  );
}

/** Progress through an entity: a bar with its label, or the percentage. */
function CardProgress(value: unknown, label: string | undefined, name: string, locale: string): VNode {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const pct = formatPercent(v, locale);
  return h(
    "div",
    { class: "pxd-progress" },
    h("div", { class: "pxd-progress-track", role: "progressbar", "aria-label": `Progress: ${name}`, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v * 100), "aria-valuetext": label ?? pct }, h("div", { class: "pxd-progress-fill", style: { width: `${v * 100}%` } })),
    h("span", { class: "pxd-progress-label" }, label ?? pct),
  );
}

export function Disclosure(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  // Design Direction can say a product shows everything rather than tucking detail away.
  const [open, setOpen] = ctx.state<boolean>(node, "open", () => node.open ?? ctx.r.disclosure === "show-everything");
  const contentId = ctx.id(node, "content");
  const state = open ? "open" : "closed";
  return h(
    "div",
    { "data-state": state, class: "pxd-disclosure", ...ctx.a11y(node) },
    h(
      "button",
      { type: "button", "aria-controls": open ? contentId : undefined, "aria-expanded": open, "data-state": state, class: "pxd-disclosure-trigger", onClick: () => setOpen(!open) },
      h("span", { class: "pxd-disclosure-icon", "aria-hidden": "true" }, open ? "▾" : "▸"),
      b.text(node.summary),
    ),
    h("div", { "data-state": state, id: contentId, hidden: !open, class: "pxd-disclosure-content" }, open ? h("div", { class: "pxd-stack" }, ...Children(ctx, node.children)) : null),
  );
}

export function Views(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const bound = node.selected ? b.value<string>(node.selected) : undefined;
  const [local, setLocal] = ctx.state<string | undefined>(node, "view", undefined);
  const selected = selectedView(node.views, bound, local);
  const change = (key: string) => (node.selected ? b.write(node.selected, key) : setLocal(key));
  return Tabs({
    id: ctx.id(node),
    value: selected,
    onValueChange: change,
    rootClass: `pxd-views pxd-views-${node.variant ?? "tabs"}`,
    rootProps: ctx.a11y(node),
    listClass: "pxd-views-list",
    tabClass: "pxd-views-tab",
    panelClass: "pxd-views-panel",
    tabs: node.views.map((v: any) => {
      const count = v.count !== undefined ? b.value<number>(v.count) : undefined;
      return { key: v.key, label: [b.text(v.label), count !== undefined && h("span", { class: "pxd-views-count" }, formatCount(count, ctx.r.locale))], content: ctx.render(v.content) };
    }),
  });
}
