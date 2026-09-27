import { TABLE_COMPACT_PX, absolute, asList, childPointer, columnCount, formatCount, formatValue, get, isNumericColumn as isNumeric, nextSort, paging as pagingOf, resolve, resolveFormat, rowValue, safeColor, stackedColumns, toggleValue, type Node, type Scope } from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Checkbox, Menu, closedMenu, menuTrigger, type MenuState } from "../primitives.ts";
import { Avatar, Icon } from "./avatar.ts";

/**
 * Table: the dense list B2B software is made of. Saved views, a toolbar with search and filters,
 * sortable columns, selection with bulk actions, a menu per row, and paging. On compact surfaces
 * it becomes a list of rows, because 7 columns don't fit a phone.
 */
export function Table(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const [compact, setCompact] = ctx.state<boolean>(node, "compact", false);
  const pointer = absolute(node.rows.path, b.scope);
  const rows = asList(get(r.data, pointer));
  const caption = b.text(node.caption);
  // Expandable rows: which are open, by row value. The detail renders in the row's scope.
  const expandable = !!node.detail && node.expandable !== false;
  const [expanded, setExpanded] = ctx.state<unknown[]>(node, "expanded", () => []);
  const isOpen = (v: unknown) => expanded.includes(v);
  const toggleOpen = (v: unknown) => setExpanded((cur) => toggleValue(cur, v));
  const expander = (v: unknown, name: string) => h("button", { type: "button", class: "pxd-icon-button pxd-table-expander", "aria-expanded": isOpen(v), "aria-label": `${isOpen(v) ? "Hide" : "Show"} details for ${name}`, onClick: () => toggleOpen(v) }, Icon(isOpen(v) ? "sortUp" : "sortDown", 16));

  // Selection is host state: an array of row values.
  const selection = node.selection === "multiple";
  const selected: unknown[] = selection && node.selected ? (b.value<unknown[]>(node.selected) ?? []) : [];
  const valueOf = (scope: Scope, i: number) => rowValue(node, rows, i, r.data, scope);
  const toggle = (v: unknown) => b.write(node.selected, toggleValue(selected, v));
  const allValues = rows.map((_, i) => valueOf({ pointer: childPointer(pointer, i) }, i));
  const allSelected = rows.length > 0 && allValues.every((v) => selected.includes(v));
  const toggleAll = () => b.write(node.selected, allSelected ? [] : allValues);

  // Sorting is host state too: the column key and direction it re-queried with.
  const sortColumn = node.sort?.column ? b.value<string>(node.sort.column) : undefined;
  const sortDirection = node.sort?.direction ? b.value<string>(node.sort.direction) : "ascending";
  const sortBy = (key: string) => {
    const next = nextSort(key, sortColumn, sortDirection);
    if (node.sort?.column) b.write(node.sort.column, key);
    if (node.sort?.direction) b.write(node.sort.direction, next);
    if (node.sort?.action) r.dispatch(node.sort.action, b.scope, node.id);
  };

  const check = (indicator: VChild) => h("span", { "data-state": "checked", style: { pointerEvents: "none" } }, indicator);
  const cell = (c: any, scope: Scope): VChild => {
    const raw = get(r.data, absolute(c.path, scope));
    const text = formatValue(raw, resolveFormat(c.format, r.data, b.scope), r.locale);
    if (c.kind === "status") return h("span", { class: `pxd-badge pxd-tone-${c.tones?.[String(raw)] ?? "neutral"}` }, text);
    if (c.format?.type === "color") return h("span", { class: "pxd-color-value" }, h("span", { class: `pxd-swatch${safeColor(text) ? "" : " pxd-swatch-unknown"}`, style: safeColor(text) ? { background: safeColor(text) } : undefined, "aria-hidden": "true" }), text);
    if (c.kind === "entity") {
      const second = c.secondaryPath ? String(get(r.data, absolute(c.secondaryPath, scope)) ?? "") : "";
      return h(
        "span",
        { class: "pxd-entity" },
        c.avatarPath && Avatar(ctx, { value: get(r.data, absolute(c.avatarPath, scope)), name: text, size: 28 }),
        h("span", { class: "pxd-entity-text" }, node.rowAction ? h("button", { type: "button", class: "pxd-link", onClick: () => r.dispatch(node.rowAction, scope, node.id) }, text) : h("span", { class: "pxd-entity-name" }, text), second && h("span", { class: "pxd-entity-secondary" }, second)),
      );
    }
    if (c.kind === "link" && node.rowAction) return h("button", { type: "button", class: "pxd-link", onClick: () => r.dispatch(node.rowAction, scope, node.id) }, text);
    return text;
  };

  const rowMenu = (scope: Scope, name: string, i: number): VChild => {
    const bar = r.byId.get(node.rowActions);
    // A row's menu honours each Action's `visible` against that row, so a stage shows only its own moves.
    const actions = (bar?.children ?? []).map((id: string) => r.byId.get(id)).filter((a: Node | undefined): a is Node => Boolean(a) && (a!.visible === undefined || resolve(a!.visible, r.data, scope) !== false));
    if (!actions.length) return null;
    const id = ctx.id(node, `row-${i}-menu`);
    const [menu, setMenu] = ctx.state<MenuState>(node, `menu:${i}`, closedMenu);
    Menu(ctx, id, menu, setMenu, actions.map((a: Node) => ({ key: a.id, label: [b.text(a.label)], class: `pxd-menu-item${a.tone === "danger" ? " pxd-menu-item-danger" : ""}`, onSelect: () => r.dispatch(a.action, scope, a.id) })), { class: "pxd-menu" });
    return h("button", { type: "button", ...menuTrigger(id, menu, setMenu, "end", { class: "pxd-icon-button", "aria-label": `Actions for ${name}` }) }, Icon("dots", 18));
  };

  const header: VChild[] = [
    node.views && TableViews(node, ctx),
    (node.search || node.toolbar || (selection && selected.length > 0)) &&
      h(
        "div",
        { class: `pxd-table-toolbar${selected.length > 0 ? " pxd-table-bulk" : ""}`, role: "toolbar", "aria-label": selected.length > 0 ? `Actions for ${selected.length} selected` : "Table tools" },
        ...(selected.length > 0
          ? [h("p", { class: "pxd-bulk-count", "aria-live": "polite" }, `${selected.length} selected`), node.bulkActions && ctx.render(node.bulkActions), h("button", { type: "button", class: "pxd-button pxd-button-tertiary", onClick: () => b.write(node.selected, []) }, "Cancel")]
          : [node.search && ctx.render(node.search), h("span", { class: "pxd-table-toolbar-spacer" }), node.toolbar && ctx.render(node.toolbar)]),
      ),
  ];

  const rowList = () =>
    h(
      "ul",
      { class: "pxd-row-list", "aria-label": caption },
      ...rows.map((_, i) => {
        const scope = { pointer: childPointer(pointer, i) };
        const { first, status, details } = stackedColumns(node.columns);
        const name = formatValue(get(r.data, absolute(first.path, scope)), resolveFormat(first.format, r.data, b.scope), r.locale);
        const v = valueOf(scope, i);
        return h(
          "li",
          { key: String(v), class: "pxd-row-item" },
          selection && node.selected && Checkbox({ class: "pxd-checkbox", checked: selected.includes(v), onCheckedChange: () => toggle(v), "aria-label": `Select ${name}`, indicator: check(Icon("check", 14)) }),
          expandable && expander(v, name),
          h(
            "div",
            { class: "pxd-row-main" },
            h("div", { class: "pxd-row-title" }, cell(first, scope)),
            h("p", { class: "pxd-row-details" }, ...details.map((c: any, ci: number) => h("span", { key: c.key }, ci > 0 && h("span", { "aria-hidden": "true" }, " · "), h("span", { class: "pxd-sr-only" }, `${b.text(c.label)}: `), formatValue(get(r.data, absolute(c.path, scope)), resolveFormat(c.format, r.data, b.scope), r.locale)))),
          ),
          status && cell(status, scope),
          node.rowActions ? rowMenu(scope, name, i) : node.rowAction && !node.columns[0].kind ? h("button", { type: "button", class: "pxd-button pxd-button-tertiary", onClick: () => r.dispatch(node.rowAction, scope, node.id) }, "Select", h("span", { class: "pxd-sr-only" }, ` ${name}`)) : null,
          expandable && isOpen(v) && h("div", { class: "pxd-row-detail" }, ctx.render(node.detail, scope)),
        );
      }),
    );

  const grid = () =>
    h(
      "div",
      { class: "pxd-table-scroll" },
      h(
        "table",
        { class: "pxd-table" },
        h("caption", { class: node.views || node.search ? "pxd-sr-only" : undefined }, caption),
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            expandable && h("th", { scope: "col", class: "pxd-table-expand" }, h("span", { class: "pxd-sr-only" }, "Details")),
            selection && node.selected && h("th", { scope: "col", class: "pxd-table-select" }, Checkbox({ class: "pxd-checkbox", checked: allSelected ? true : selected.length > 0 ? "indeterminate" : false, onCheckedChange: toggleAll, "aria-label": "Select all rows", indicator: h("span", { "data-state": allSelected ? "checked" : "indeterminate", style: { pointerEvents: "none" } }, Icon(allSelected ? "check" : "dash", 14)) })),
            ...node.columns.map((c: any) => {
              const sorted = c.key === sortColumn;
              return h(
                "th",
                { key: c.key, scope: "col", class: isNumeric(c) ? "pxd-num" : undefined, "aria-sort": c.sortable ? (sorted ? sortDirection : "none") : undefined },
                c.sortable ? h("button", { type: "button", class: "pxd-sort", onClick: () => sortBy(c.key) }, b.text(c.label), Icon(sorted ? (sortDirection === "descending" ? "sortDown" : "sortUp") : "sort", 16)) : b.text(c.label),
              );
            }),
            (node.rowActions || node.rowAction) && h("th", { scope: "col" }, h("span", { class: "pxd-sr-only" }, "Actions")),
          ),
        ),
        h(
          "tbody",
          null,
          ...rows.flatMap((_, i) => {
            const scope = { pointer: childPointer(pointer, i) };
            const v = valueOf(scope, i);
            const name = formatValue(get(r.data, absolute(node.columns[0].path, scope)), resolveFormat(node.columns[0].format, r.data, b.scope), r.locale);
            return [
              h(
                "tr",
                { key: String(v), class: selected.includes(v) ? "pxd-row-selected" : undefined, "aria-selected": selection ? selected.includes(v) : undefined },
                expandable && h("td", { class: "pxd-table-expand" }, expander(v, name)),
                selection && node.selected && h("td", { class: "pxd-table-select" }, Checkbox({ class: "pxd-checkbox", checked: selected.includes(v), onCheckedChange: () => toggle(v), "aria-label": `Select ${name}`, indicator: check(Icon("check", 14)) })),
                ...node.columns.map((c: any, ci: number) => h(ci === 0 ? "th" : "td", { key: c.key, scope: ci === 0 ? "row" : undefined, "data-label": b.text(c.label), class: isNumeric(c) ? "pxd-num" : undefined }, cell(c, scope))),
                (node.rowActions || node.rowAction) && h("td", { class: "pxd-table-action" }, node.rowActions ? rowMenu(scope, name, i) : h("button", { type: "button", class: "pxd-button pxd-button-tertiary", onClick: () => r.dispatch(node.rowAction, scope, node.id) }, "Select", h("span", { class: "pxd-sr-only" }, ` ${name}`))),
              ),
              expandable && isOpen(v) && h("tr", { key: `${String(v)}-detail`, class: "pxd-table-detail" }, h("td", { colspan: columnCount(node, expandable, Boolean(selection && node.selected)) }, ctx.render(node.detail, scope))),
            ];
          }),
        ),
      ),
    );

  const body = !rows.length && node.empty ? ctx.render(node.empty) : compact ? rowList() : grid();
  return h("div", { class: "pxd-table-wrap", ...ctx.a11y(node), ref: (el: Element | null) => el && r.observeWidth(el, `${node.id}:table`, (w) => setCompact(w < TABLE_COMPACT_PX)) }, ...header, body, node.page && Paging(node, ctx, rows.length));
}

/** Saved views: All, Mine, Past due — tabs with counts, switching what the host sends. */
function TableViews(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const current = node.view ? b.value<string>(node.view) : node.views[0].key;
  return h(
    "div",
    { class: "pxd-table-views", role: "tablist", "aria-label": "Saved views" },
    ...node.views.map((v: any) => {
      const count = v.count !== undefined ? b.value<number>(v.count) : undefined;
      const on = v.key === current;
      return h(
        "button",
        {
          key: v.key,
          type: "button",
          role: "tab",
          "aria-selected": on,
          class: `pxd-table-view${on ? " pxd-table-view-current" : ""}`,
          onClick: () => {
            if (node.view) b.write(node.view, v.key);
            ctx.r.dispatch(v.action, b.scope, node.id);
          },
        },
        b.text(v.label),
        count !== undefined && h("span", { class: "pxd-views-count" }, formatCount(count, ctx.r.locale)),
      );
    }),
  );
}

/** Rows per page, the range shown, and the way to the next page. A Collection with 'page' uses it too. */
export function Paging(node: Node, ctx: Ctx, rows: number): VNode {
  const b = ctx.b;
  const p = node.page;
  const { index, size, total, pages, from, to, sizes } = pagingOf(p.index ? b.value(p.index) : undefined, p.size ? b.value(p.size) : undefined, p.total ? b.value(p.total) : undefined, rows);
  const n = (v: number) => formatCount(v, ctx.r.locale);
  const go = (next: number) => {
    if (p.index) b.write(p.index, next);
    ctx.r.dispatch(p.action, b.scope, node.id);
  };
  return h(
    "div",
    { class: "pxd-paging" },
    p.size &&
      h(
        "label",
        { class: "pxd-paging-size" },
        "Rows per page",
        h(
          "select",
          {
            value: String(size),
            onChange: (e: Event) => {
              b.write(p.size, Number((e.target as HTMLSelectElement).value));
              if (p.index) b.write(p.index, 1);
              ctx.r.dispatch(p.action, b.scope, node.id);
            },
          },
          ...sizes.map((x) => h("option", { key: x, value: String(x), selected: x === size }, String(x))),
        ),
      ),
    h("p", { class: "pxd-paging-range", "aria-live": "polite" }, `${n(from)}–${n(to)} of ${n(total)}`),
    h(
      "div",
      { class: "pxd-paging-controls" },
      h("button", { type: "button", class: "pxd-icon-button", "aria-label": "Previous page", disabled: index <= 1, onClick: () => go(index - 1) }, Icon("chevronLeft", 18)),
      h("span", { class: "pxd-paging-page" }, `Page ${n(index)} of ${n(pages)}`),
      h("button", { type: "button", class: "pxd-icon-button", "aria-label": "Next page", disabled: index >= pages, onClick: () => go(index + 1) }, Icon("chevronRight", 18)),
    ),
  );
}
