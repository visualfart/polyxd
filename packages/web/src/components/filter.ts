import { FILTER_COMPACT_PX, activeFilters, resultCountText, type Node } from "@polyxd/core";
import { h, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Dialog, dialogClose } from "../primitives.ts";
import { Icon } from "./avatar.ts";
import { Heading } from "./structure.ts";

/**
 * FilterPanel: filters beside their results on wide surfaces; on compact ones a "Filters · n"
 * button opens a bottom sheet that ends in "Show n results". Search fields stay above the results
 * everywhere. Active filters show as removable chips; the result count is announced politely.
 */
export function FilterPanel(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const [compact, setCompact] = ctx.state<boolean>(node, "compact", false);
  const [open, setOpen] = ctx.state<boolean>(node, "open", false);
  const a11y = ctx.a11y(node);
  const sheetId = ctx.id(node, "sheet");
  const label = node.label !== undefined ? b.text(node.label) : "Filters";
  const children: Node[] = (node.children ?? []).map((id: string) => r.byId.get(id)).filter(Boolean);
  const searches = children.filter((c) => c.component === "TextInput" && c.kind === "search");
  const filters = children.filter((c) => !searches.includes(c));
  const active = activeFilters(filters, r.data, b.scope, r.locale, b.text);
  const remove = (f: (typeof active)[number]) => r.surface.write(f.binding, f.cleared, b.scope);
  const count = node.resultCount !== undefined ? b.value<number>(node.resultCount) : undefined;
  const countText = resultCountText(count, r.locale);
  const clearAll = () => {
    for (const f of active) remove(f);
    if (node.clear) r.dispatch(node.clear, b.scope, node.id);
  };
  const close = () => setOpen(false);

  const filterFields = () => filters.map((c) => ctx.render(c.id));
  const results = h(
    "div",
    { class: "pxd-filter-results" },
    ...searches.map((c) => ctx.render(c.id)),
    h(
      "div",
      { class: "pxd-filter-status" },
      compact &&
        h(
          "button",
          { type: "button", class: "pxd-chip pxd-filter-trigger", "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": open ? sheetId : undefined, "data-state": open ? "open" : "closed", onClick: () => setOpen(true) },
          Icon("filter", 18),
          label,
          active.length > 0 && h("span", { "aria-hidden": "true" }, ` · ${active.length}`),
          active.length > 0 && h("span", { class: "pxd-sr-only" }, `, ${active.length} active`),
        ),
      countText && h("p", { class: "pxd-filter-count", "aria-live": "polite" }, countText),
    ),
    active.length > 0 &&
      h(
        "ul",
        { class: "pxd-filter-chips", "aria-label": "Active filters" },
        ...active.map((f) => h("li", { key: f.key }, h("button", { type: "button", class: "pxd-chip pxd-filter-chip", onClick: () => remove(f), "aria-label": `Remove filter: ${f.label}` }, f.label, Icon("close", 16)))),
        h("li", null, h("button", { type: "button", class: "pxd-button pxd-button-tertiary pxd-filter-clear", onClick: clearAll }, "Clear all")),
      ),
    ctx.render(node.results),
  );

  if (compact && open) {
    const titleId = ctx.id(node, "sheet-title");
    ctx.portal(
      Dialog(
        { ctx, id: sheetId, class: "pxd-sheet", onClose: close, props: { id: sheetId, "aria-labelledby": titleId } },
        h("div", { class: "pxd-sheet-header" }, h("h2", { id: titleId, class: "pxd-sheet-title" }, label), dialogClose(close, { class: "pxd-icon-button", "aria-label": "Close" }, Icon("close"))),
        h("div", { class: "pxd-sheet-body pxd-stack" }, ...filterFields()),
        h("div", { class: "pxd-sheet-footer" }, active.length > 0 && h("button", { type: "button", class: "pxd-button pxd-button-secondary", onClick: clearAll }, "Clear all"), dialogClose(close, { class: "pxd-button pxd-button-primary" }, countText ? `Show ${countText}` : "Show results")),
      ),
    );
  }

  return h(
    "div",
    { class: `pxd-filter-panel${compact ? " pxd-filter-compact" : ""}`, ...a11y, ref: (el: Element | null) => el && r.observeWidth(el, `${node.id}:filter`, (w) => setCompact(w < FILTER_COMPACT_PX)) },
    compact ? results : h("div", { class: "pxd-filter-layout" }, h("section", { class: "pxd-filter-sidebar", "aria-label": label }, Heading(ctx, "pxd-filter-title", label), h("div", { class: "pxd-stack" }, ...filterFields())), results),
  );
}
