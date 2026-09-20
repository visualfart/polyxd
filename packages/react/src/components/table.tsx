import { useLayoutEffect, useRef, useState } from "react";
import { Checkbox, DropdownMenu } from "radix-ui";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { asList, absolute, childPointer, get, type Scope } from "../data.ts";
import { formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Avatar, Icon } from "./avatar.tsx";

/** Below this width a table becomes a list of rows. */
const COMPACT_PX = 720;
const NUMERIC = new Set(["number", "currency", "percent", "duration"]);
const PAGE_SIZES = [10, 25, 50, 100];

const isNumeric = (c: any) => c.align === "end" || (c.align !== "start" && (c.kind === "number" || c.kind === "currency" || NUMERIC.has(c.format?.type)));

/**
 * Table: the dense list B2B software is made of. Saved views, a toolbar with search and filters,
 * sortable columns, selection with bulk actions, a menu per row, and paging. On compact surfaces
 * it becomes a list of rows, because 7 columns don't fit a phone.
 */
export function Table({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const pointer = absolute(node.rows.path, b.scope);
  const rows = asList(get(s.data, pointer));
  const caption = b.text(node.caption);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setCompact(el.getBoundingClientRect().width < COMPACT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Selection is host state: an array of row values.
  const selection = node.selection === "multiple";
  const selected: unknown[] = selection && node.selected ? (b.value<unknown[]>(node.selected) ?? []) : [];
  const valueOf = (scope: Scope, i: number) => (node.rowValuePath ? get(s.data, absolute(node.rowValuePath, scope)) : ((rows[i] as { id?: unknown })?.id ?? i));
  const toggle = (v: unknown) => b.write(node.selected, selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const allValues = rows.map((_, i) => valueOf({ pointer: childPointer(pointer, i) }, i));
  const allSelected = rows.length > 0 && allValues.every((v) => selected.includes(v));
  const toggleAll = () => b.write(node.selected, allSelected ? [] : allValues);

  // Sorting is host state too: the column key and direction it re-queried with.
  const sortColumn = node.sort?.column ? b.value<string>(node.sort.column) : undefined;
  const sortDirection = node.sort?.direction ? b.value<string>(node.sort.direction) : "ascending";
  const sortBy = (key: string) => {
    const next = key === sortColumn && sortDirection === "ascending" ? "descending" : "ascending";
    if (node.sort?.column) b.write(node.sort.column, key);
    if (node.sort?.direction) b.write(node.sort.direction, next);
    if (node.sort?.action) s.dispatch(node.sort.action, b.scope, node.id);
  };

  const cell = (c: any, scope: Scope) => {
    const raw = get(s.data, absolute(c.path, scope));
    const text = formatValue(raw, resolveFormat(c.format, s.data, b.scope), s.locale);
    if (c.kind === "status") return <span className={`pxd-badge pxd-tone-${c.tones?.[String(raw)] ?? "neutral"}`}>{text}</span>;
    if (c.kind === "entity") {
      const second = c.secondaryPath ? String(get(s.data, absolute(c.secondaryPath, scope)) ?? "") : "";
      return (
        <span className="pxd-entity">
          {c.avatarPath && <Avatar value={get(s.data, absolute(c.avatarPath, scope))} name={text} size={28} />}
          <span className="pxd-entity-text">
            {node.rowAction ? (
              <button type="button" className="pxd-link" onClick={() => s.dispatch(node.rowAction, scope, node.id)}>
                {text}
              </button>
            ) : (
              <span className="pxd-entity-name">{text}</span>
            )}
            {second && <span className="pxd-entity-secondary">{second}</span>}
          </span>
        </span>
      );
    }
    if (c.kind === "link" && node.rowAction)
      return (
        <button type="button" className="pxd-link" onClick={() => s.dispatch(node.rowAction, scope, node.id)}>
          {text}
        </button>
      );
    return text;
  };

  const rowMenu = (scope: Scope, name: string) => {
    const bar = s.byId.get(node.rowActions);
    const actions = (bar?.children ?? []).map((id: string) => s.byId.get(id)).filter(Boolean);
    if (!actions.length) return null;
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="pxd-icon-button" aria-label={`Actions for ${name}`}>
          <Icon name="dots" size={18} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={s.portal}>
          <DropdownMenu.Content className="pxd-menu" align="end">
            {actions.map((a: Node) => (
              <DropdownMenu.Item key={a.id} className={`pxd-menu-item${a.tone === "danger" ? " pxd-menu-item-danger" : ""}`} onSelect={() => s.dispatch(a.action, scope, a.id)}>
                {b.text(a.label)}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  };

  const header = (
    <>
      {node.views && <Views node={node} />}
      {(node.search || node.toolbar || (selection && selected.length > 0)) && (
        <div className={`pxd-table-toolbar${selected.length > 0 ? " pxd-table-bulk" : ""}`} role="toolbar" aria-label={selected.length > 0 ? `Actions for ${selected.length} selected` : "Table tools"}>
          {selected.length > 0 ? (
            <>
              <p className="pxd-bulk-count" aria-live="polite">
                {selected.length} selected
              </p>
              {node.bulkActions && <Render id={node.bulkActions} />}
              <button type="button" className="pxd-button pxd-button-tertiary" onClick={() => b.write(node.selected, [])}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {node.search && <Render id={node.search} />}
              <span className="pxd-table-toolbar-spacer" />
              {node.toolbar && <Render id={node.toolbar} />}
            </>
          )}
        </div>
      )}
    </>
  );

  const body = !rows.length && node.empty ? <Render id={node.empty} /> : compact ? <RowList /> : <Grid />;

  function RowList() {
    return (
      <ul className="pxd-row-list" aria-label={caption}>
        {rows.map((_, i) => {
          const scope = { pointer: childPointer(pointer, i) };
          const [first, ...rest] = node.columns;
          const name = formatValue(get(s.data, absolute(first.path, scope)), resolveFormat(first.format, s.data, b.scope), s.locale);
          const status = rest.find((c: any) => c.kind === "status");
          const details = rest.filter((c: any) => c.kind !== "status").slice(0, 3);
          return (
            <li key={String(valueOf(scope, i))} className="pxd-row-item">
              {selection && node.selected && (
                <Checkbox.Root className="pxd-checkbox" checked={selected.includes(valueOf(scope, i))} onCheckedChange={() => toggle(valueOf(scope, i))} aria-label={`Select ${name}`}>
                  <Checkbox.Indicator>
                    <Icon name="check" size={14} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
              )}
              <div className="pxd-row-main">
                <div className="pxd-row-title">{cell(first, scope)}</div>
                <p className="pxd-row-details">
                  {details.map((c: any, ci: number) => (
                    <span key={c.key}>
                      {ci > 0 && <span aria-hidden="true"> · </span>}
                      <span className="pxd-sr-only">{b.text(c.label)}: </span>
                      {formatValue(get(s.data, absolute(c.path, scope)), resolveFormat(c.format, s.data, b.scope), s.locale)}
                    </span>
                  ))}
                </p>
              </div>
              {status && cell(status, scope)}
              {node.rowActions ? (
                rowMenu(scope, name)
              ) : node.rowAction && !node.columns[0].kind ? (
                // The same button as in the table, so an agent's steps work at any width.
                <button type="button" className="pxd-button pxd-button-tertiary" onClick={() => s.dispatch(node.rowAction, scope, node.id)}>
                  Select<span className="pxd-sr-only"> {name}</span>
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  function Grid() {
    return (
      <div className="pxd-table-scroll">
        <table className="pxd-table">
          <caption className={node.views || node.search ? "pxd-sr-only" : undefined}>{caption}</caption>
          <thead>
            <tr>
              {selection && node.selected && (
                <th scope="col" className="pxd-table-select">
                  <Checkbox.Root className="pxd-checkbox" checked={allSelected ? true : selected.length > 0 ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all rows">
                    <Checkbox.Indicator>
                      <Icon name={allSelected ? "check" : "dash"} size={14} />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                </th>
              )}
              {node.columns.map((c: any) => {
                const sorted = c.key === sortColumn;
                return (
                  <th key={c.key} scope="col" className={isNumeric(c) ? "pxd-num" : undefined} aria-sort={c.sortable ? (sorted ? (sortDirection as "ascending" | "descending") : "none") : undefined}>
                    {c.sortable ? (
                      <button type="button" className="pxd-sort" onClick={() => sortBy(c.key)}>
                        {b.text(c.label)}
                        <Icon name={sorted ? (sortDirection === "descending" ? "sortDown" : "sortUp") : "sort"} size={16} />
                      </button>
                    ) : (
                      b.text(c.label)
                    )}
                  </th>
                );
              })}
              {(node.rowActions || node.rowAction) && (
                <th scope="col">
                  <span className="pxd-sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((_, i) => {
              const scope = { pointer: childPointer(pointer, i) };
              const v = valueOf(scope, i);
              const name = formatValue(get(s.data, absolute(node.columns[0].path, scope)), resolveFormat(node.columns[0].format, s.data, b.scope), s.locale);
              return (
                <tr key={String(v)} className={selected.includes(v) ? "pxd-row-selected" : undefined} aria-selected={selection ? selected.includes(v) : undefined}>
                  {selection && node.selected && (
                    <td className="pxd-table-select">
                      <Checkbox.Root className="pxd-checkbox" checked={selected.includes(v)} onCheckedChange={() => toggle(v)} aria-label={`Select ${name}`}>
                        <Checkbox.Indicator>
                          <Icon name="check" size={14} />
                        </Checkbox.Indicator>
                      </Checkbox.Root>
                    </td>
                  )}
                  {node.columns.map((c: any, ci: number) => {
                    const Cell = ci === 0 ? "th" : "td";
                    return (
                      <Cell key={c.key} scope={ci === 0 ? "row" : undefined} data-label={b.text(c.label)} className={isNumeric(c) ? "pxd-num" : undefined}>
                        {cell(c, scope)}
                      </Cell>
                    );
                  })}
                  {(node.rowActions || node.rowAction) && (
                    <td className="pxd-table-action">
                      {node.rowActions ? (
                        rowMenu(scope, name)
                      ) : (
                        <button type="button" className="pxd-button pxd-button-tertiary" onClick={() => s.dispatch(node.rowAction, scope, node.id)}>
                          Select<span className="pxd-sr-only"> {name}</span>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div ref={ref} className="pxd-table-wrap" {...useA11y(node)}>
      {header}
      {body}
      {node.page && <Paging node={node} rows={rows.length} />}
    </div>
  );
}

/** Saved views: All, Mine, Past due — tabs with counts, switching what the host sends. */
function Views({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const current = node.view ? b.value<string>(node.view) : node.views[0].key;
  return (
    <div className="pxd-table-views" role="tablist" aria-label="Saved views">
      {node.views.map((v: any) => {
        const count = v.count !== undefined ? b.value<number>(v.count) : undefined;
        const on = v.key === current;
        return (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={on}
            className={`pxd-table-view${on ? " pxd-table-view-current" : ""}`}
            onClick={() => {
              if (node.view) b.write(node.view, v.key);
              s.dispatch(v.action, b.scope, node.id);
            }}
          >
            {b.text(v.label)}
            {count !== undefined && <span className="pxd-views-count">{new Intl.NumberFormat(s.locale).format(count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Rows per page, the range shown, and the way to the next page. */
function Paging({ node, rows }: { node: Node; rows: number }) {
  const b = useBindings();
  const s = useSurface();
  const p = node.page;
  const index = p.index ? (b.value<number>(p.index) ?? 1) : 1;
  const size = p.size ? (b.value<number>(p.size) ?? rows) : rows;
  const total = p.total ? (b.value<number>(p.total) ?? rows) : rows;
  const pages = Math.max(1, Math.ceil(total / (size || 1)));
  const from = total === 0 ? 0 : (index - 1) * size + 1;
  const to = Math.min(index * size, total);
  const n = (v: number) => new Intl.NumberFormat(s.locale).format(v);
  const go = (next: number) => {
    if (p.index) b.write(p.index, next);
    s.dispatch(p.action, b.scope, node.id);
  };
  return (
    <div className="pxd-paging">
      {p.size && (
        <label className="pxd-paging-size">
          Rows per page
          <select
            value={size}
            onChange={(e) => {
              b.write(p.size, Number(e.target.value));
              if (p.index) b.write(p.index, 1);
              s.dispatch(p.action, b.scope, node.id);
            }}
          >
            {[...new Set([...PAGE_SIZES, size])].sort((a, c) => a - c).map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="pxd-paging-range" aria-live="polite">
        {n(from)}–{n(to)} of {n(total)}
      </p>
      <div className="pxd-paging-controls">
        <button type="button" className="pxd-icon-button" aria-label="Previous page" disabled={index <= 1} onClick={() => go(index - 1)}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className="pxd-paging-page">
          Page {n(index)} of {n(pages)}
        </span>
        <button type="button" className="pxd-icon-button" aria-label="Next page" disabled={index >= pages} onClick={() => go(index + 1)}>
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </div>
  );
}
