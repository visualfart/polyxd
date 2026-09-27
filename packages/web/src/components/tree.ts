import { TYPEAHEAD_MS, VIRTUAL_LIMIT, asList, treeKey, treeRows, typeAheadTarget, visibleWindow, type Node, type TreeRow } from "@polyxd/core";
import { h, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Icon } from "./avatar.ts";

/** Fallback row height (px) until the first row has been measured. */
const FALLBACK_ROW_HEIGHT = 40;

/**
 * Tree: a hierarchy people expand, browse and pick from (WAI-ARIA APG tree view). The visible
 * nodes are flattened into rows (core) so level, position and set size can be exposed, and a
 * large tree renders only the rows near its viewport. Focus roves: one row is tabbable, arrows
 * move between them.
 */
export function Tree(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const captionId = ctx.id(node, "caption");
  const selection: "none" | "single" | "multiple" = node.selection ?? "none";
  const selectable = selection !== "none" && !!node.selected;

  // Expanded state: host data when bound, else local with the first level open.
  const boundExpanded = node.expanded ? asList(b.value<unknown>(node.expanded)) : undefined;
  const [localExpanded, setLocalExpanded] = ctx.state<Set<unknown> | null>(node, "expanded", null);
  const expandedSet = boundExpanded ? new Set(boundExpanded) : localExpanded;
  const selected = selectable ? b.value<unknown>(node.selected) : undefined;
  const isSelected = (v: unknown) => (Array.isArray(selected) ? selected.includes(v) : selected !== undefined && selected === v);
  const { rows, indexByKey, topValues } = treeRows(node, r.data, b.scope, expandedSet);

  // Roving tabindex: focus is tracked by node pointer so it survives expand/collapse and data updates.
  const [focusKey, setFocusKey] = ctx.state<string | null>(node, "focus", null);
  const focusIndex = (focusKey !== null ? indexByKey.get(focusKey) : undefined) ?? 0;
  const [pending] = ctx.state<{ index: number | null }>(node, "pending", () => ({ index: null }));

  // Virtualisation: only past VIRTUAL_LIMIT rows, when the list becomes its own scroll viewport.
  const virtual = rows.length > VIRTUAL_LIMIT;
  const [geometry, setGeometry] = ctx.state<{ rowHeight: number; viewportHeight: number; scrollTop: number }>(node, "geometry", () => ({ rowHeight: FALLBACK_ROW_HEIGHT, viewportHeight: FALLBACK_ROW_HEIGHT * 12, scrollTop: 0 }));
  const { start, end } = visibleWindow(rows.length, geometry.scrollTop, geometry.rowHeight, geometry.viewportHeight);
  const listOf = () => r.root?.querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(node.id)}"] .pxd-tree-list`);

  // Move focus to a row; when it is outside the rendered window, scroll so it gets rendered first.
  const focusRow = (index: number) => {
    if (!rows.length) return;
    const i = Math.max(0, Math.min(rows.length - 1, index));
    setFocusKey(rows[i].key);
    const el = listOf()?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (el) return el.focus();
    pending.index = i;
    const vp = listOf()?.parentElement;
    if (virtual && vp?.classList.contains("pxd-tree-viewport")) {
      const top = Math.max(0, i * geometry.rowHeight - (geometry.viewportHeight - geometry.rowHeight) / 2);
      vp.scrollTop = top;
      setGeometry({ ...geometry, scrollTop: top });
    }
  };
  ctx.after(() => {
    if (pending.index === null) return;
    const el = listOf()?.querySelector<HTMLElement>(`[data-index="${pending.index}"]`);
    if (el) {
      pending.index = null;
      el.focus();
    }
    if (virtual) {
      const first = listOf()?.querySelector<HTMLElement>(".pxd-tree-item");
      const vp = listOf()?.parentElement;
      const rowHeight = first && first.offsetHeight > 0 ? first.offsetHeight : geometry.rowHeight;
      const viewportHeight = vp?.clientHeight || geometry.viewportHeight;
      if (rowHeight !== geometry.rowHeight || viewportHeight !== geometry.viewportHeight) setGeometry({ ...geometry, rowHeight, viewportHeight });
    }
  });

  const setExpanded = (values: unknown[], open: boolean) => {
    if (node.expanded) {
      const cur = boundExpanded ?? [];
      b.write(node.expanded, open ? [...cur, ...values.filter((v) => !cur.includes(v))] : cur.filter((v) => !values.includes(v)));
      return;
    }
    const next = new Set(localExpanded ?? topValues);
    for (const v of values) open ? next.add(v) : next.delete(v);
    setLocalExpanded(next);
  };
  const toggle = (row: TreeRow) => setExpanded([row.value], !row.expanded);
  const select = (row: TreeRow) => {
    if (!selectable) return;
    if (selection === "single") return b.write(node.selected, row.value);
    const cur = Array.isArray(selected) ? selected : [];
    b.write(node.selected, cur.includes(row.value) ? cur.filter((x) => x !== row.value) : [...cur, row.value]);
  };
  // Activate: select where selectable, and dispatch the action with its context bound to this node.
  const activate = (row: TreeRow) => {
    select(row);
    if (node.action) r.dispatch(node.action, row.scope, node.id);
  };
  // Type-ahead: letters typed in quick succession jump to the next label starting with them.
  const [typedState] = ctx.state<{ buffer: string; at: number }>(node, "typed", () => ({ buffer: "", at: 0 }));
  const typeAhead = (char: string) => {
    const now = Date.now();
    typedState.buffer = now - typedState.at < TYPEAHEAD_MS ? typedState.buffer + char.toLowerCase() : char.toLowerCase();
    typedState.at = now;
    const j = typeAheadTarget(rows, focusIndex, typedState.buffer);
    if (j >= 0) focusRow(j);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const row = rows[focusIndex];
    const move = treeKey(rows, focusIndex, e);
    if (!row || !move) return;
    e.preventDefault();
    e.stopPropagation();
    if ("focus" in move) focusRow(move.focus);
    else if ("toggle" in move) toggle(row);
    else if ("activate" in move) activate(row);
    else if ("select" in move) select(row);
    else if ("expandSiblings" in move) setExpanded(rows.filter((x) => x.parent === row.parent && x.hasChildren).map((x) => x.value), true);
    else if ("typeAhead" in move) typeAhead(move.typeAhead);
  };

  const caption = b.text(node.label);
  const listStyle = virtual ? { paddingTop: start * geometry.rowHeight, paddingBottom: (rows.length - end) * geometry.rowHeight } : undefined;
  const list = h(
    "ul",
    { role: "tree", class: "pxd-tree-list", "aria-labelledby": captionId, "aria-multiselectable": selection === "multiple" ? true : undefined, style: listStyle, onKeydown: onKeyDown },
    ...rows.slice(start, end).map((row, offset) => {
      const i = start + offset;
      const rowSelected = selectable ? isSelected(row.value) : undefined;
      return h(
        "li",
        {
          key: row.key,
          role: "treeitem",
          class: `pxd-tree-item${rowSelected ? " pxd-tree-item-selected" : ""}`,
          style: { "--polyxd-tree-depth": row.level - 1 },
          "data-index": i,
          tabindex: i === focusIndex ? "0" : "-1",
          "aria-level": row.level,
          "aria-setsize": row.setsize,
          "aria-posinset": row.posinset,
          "aria-expanded": row.hasChildren ? row.expanded : undefined,
          "aria-selected": rowSelected,
          onFocus: (e: FocusEvent) => {
            if (e.target === e.currentTarget) setFocusKey(row.key);
          },
          onClick: (e: Event) => {
            e.stopPropagation();
            focusRow(i);
            if (selectable) select(row);
            else if (row.hasChildren) toggle(row);
          },
          onDblclick: (e: Event) => {
            e.stopPropagation();
            if (node.action) r.dispatch(node.action, row.scope, node.id);
            else if (row.hasChildren) toggle(row);
          },
        },
        h(
          "div",
          { class: "pxd-tree-row" },
          row.hasChildren
            ? h(
                "button",
                {
                  type: "button",
                  class: `pxd-tree-expander${row.expanded ? " pxd-tree-expander-open" : ""}`,
                  tabindex: "-1",
                  "aria-hidden": "true",
                  onClick: (e: Event) => {
                    e.stopPropagation();
                    focusRow(i);
                    toggle(row);
                  },
                  onDblclick: (e: Event) => e.stopPropagation(),
                },
                Icon("chevronRight", 16),
              )
            : h("span", { class: "pxd-tree-expander pxd-tree-expander-leaf", "aria-hidden": "true" }),
          h("span", { class: "pxd-tree-text" }, row.label),
          row.detail !== undefined && h("span", { class: "pxd-tree-detail" }, row.detail),
        ),
      );
    }),
  );
  return h(
    "div",
    { class: "pxd-tree", ...ctx.a11y(node) },
    h("div", { class: "pxd-tree-caption", id: captionId }, caption),
    virtual ? h("div", { class: "pxd-tree-viewport", onScroll: (e: Event) => setGeometry({ ...geometry, scrollTop: (e.currentTarget as HTMLElement).scrollTop }) }, list) : list,
  );
}
