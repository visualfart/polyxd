import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type UIEvent } from "react";
import { ScopeContext, useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, asList, childPointer, get, type Scope } from "../data.ts";
import { useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";

/** Beyond this many visible rows the tree renders only the rows in (and just around) its viewport. */
const VIRTUAL_LIMIT = 200;
/** Rows rendered above and below the viewport so keyboard moves and quick scrolls don't flash blank. */
const OVERSCAN = 10;
/** Fallback row height (px) until the first row has been measured. */
const FALLBACK_ROW_HEIGHT = 40;
/** Type-ahead resets after this pause. */
const TYPEAHEAD_MS = 500;

/** One visible row of the flattened tree. */
interface Row {
  /** Pointer to the node in host data; stable identity for keys and focus. */
  key: string;
  scope: Scope;
  level: number;
  setsize: number;
  posinset: number;
  label: string;
  value: unknown;
  detail: string | undefined;
  hasChildren: boolean;
  expanded: boolean;
  /** Index of the parent row in the flat list, -1 at the top level. */
  parent: number;
}

const asText = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

/**
 * Tree: a hierarchy people expand, browse and pick from (WAI-ARIA APG tree view).
 *
 * The visible nodes are flattened into rows so level, position and set size can be exposed with
 * aria-level / aria-posinset / aria-setsize, and so a large tree can render only the rows near its
 * viewport (past VIRTUAL_LIMIT rows). Focus roves: one row is tabbable, arrows move between them.
 */
export function Tree({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const captionId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const itemsPointer = absolute(node.items.path, b.scope);
  const items = asList(get(s.data, itemsPointer));
  const selection: "none" | "single" | "multiple" = node.selection ?? "none";
  const selectable = selection !== "none" && !!node.selected;

  // Expanded state: host data when bound, else local with the first level open.
  const boundExpanded = node.expanded ? asList(b.value<unknown>(node.expanded)) : undefined;
  const [localExpanded, setLocalExpanded] = useState<Set<unknown> | null>(null);
  const expandedSet = useMemo(() => (boundExpanded ? new Set(boundExpanded) : localExpanded), [boundExpanded, localExpanded]);
  const isExpanded = useCallback((value: unknown, level: number) => (expandedSet ? expandedSet.has(value) : level === 1), [expandedSet]);

  // Selection: a value (single) or a list of values (multiple) in host data.
  const selected = selectable ? b.value<unknown>(node.selected) : undefined;
  const isSelected = (v: unknown) => (Array.isArray(selected) ? selected.includes(v) : selected !== undefined && selected === v);

  const readNode = useCallback(
    (scope: Scope) => {
      const label = asText(get(s.data, absolute(node.labelPath, scope)));
      const rawValue = node.valuePath ? get(s.data, absolute(node.valuePath, scope)) : label;
      const value = rawValue === undefined || rawValue === null ? label || scope.pointer : rawValue;
      const detailRaw = node.detailPath ? get(s.data, absolute(node.detailPath, scope)) : undefined;
      const detail = detailRaw === undefined || detailRaw === null || detailRaw === "" ? undefined : String(detailRaw);
      const children = asList(get(s.data, absolute(node.childrenPath, scope)));
      return { label, value, detail, children };
    },
    [s.data, node.labelPath, node.valuePath, node.detailPath, node.childrenPath],
  );

  // Flatten the open part of the hierarchy, depth first.
  const { rows, indexByKey, topValues } = useMemo(() => {
    const rows: Row[] = [];
    const indexByKey = new Map<string, number>();
    const topValues: unknown[] = [];
    const walk = (list: unknown[], pointer: string, level: number, parent: number) => {
      list.forEach((_, i) => {
        const scope = { pointer: childPointer(pointer, i) };
        const { label, value, detail, children } = readNode(scope);
        if (level === 1) topValues.push(value);
        const hasChildren = children.length > 0;
        const expanded = hasChildren && isExpanded(value, level);
        const index = rows.length;
        indexByKey.set(scope.pointer, index);
        rows.push({ key: scope.pointer, scope, level, setsize: list.length, posinset: i + 1, label, value, detail, hasChildren, expanded, parent });
        if (expanded) walk(children, absolute(node.childrenPath, scope), level + 1, index);
      });
    };
    walk(items, itemsPointer, 1, -1);
    return { rows, indexByKey, topValues };
  }, [items, itemsPointer, readNode, isExpanded, node.childrenPath]);

  // Roving tabindex: focus is tracked by node pointer so it survives expand/collapse and data updates.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const focusIndex = (focusKey !== null ? indexByKey.get(focusKey) : undefined) ?? 0;
  const pendingFocus = useRef<number | null>(null);

  // Virtualisation: only past VIRTUAL_LIMIT rows, when the list becomes its own scroll viewport.
  const virtual = rows.length > VIRTUAL_LIMIT;
  const [rowHeight, setRowHeight] = useState(FALLBACK_ROW_HEIGHT);
  const [viewportHeight, setViewportHeight] = useState(FALLBACK_ROW_HEIGHT * 12);
  const [scrollTop, setScrollTop] = useState(0);
  const start = virtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN) : 0;
  const end = virtual ? Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN) : rows.length;

  useLayoutEffect(() => {
    if (!virtual) return;
    const vp = viewportRef.current;
    const first = listRef.current?.querySelector<HTMLElement>(".pxd-tree-item");
    if (first && first.offsetHeight > 0) setRowHeight(first.offsetHeight);
    if (!vp) return;
    const measure = () => setViewportHeight(vp.clientHeight || FALLBACK_ROW_HEIGHT * 12);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [virtual]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    if (virtual) setScrollTop(e.currentTarget.scrollTop);
  };

  // Move focus to a row; when it is outside the rendered window, scroll so it gets rendered first.
  const focusRow = (index: number) => {
    if (!rows.length) return;
    const i = Math.max(0, Math.min(rows.length - 1, index));
    setFocusKey(rows[i].key);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    if (el) {
      el.focus();
      return;
    }
    pendingFocus.current = i;
    const vp = viewportRef.current;
    if (virtual && vp) {
      const top = Math.max(0, i * rowHeight - (viewportHeight - rowHeight) / 2);
      vp.scrollTop = top;
      setScrollTop(top);
    }
  };
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${pendingFocus.current}"]`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
    }
  });

  const setExpanded = (values: unknown[], open: boolean) => {
    if (node.expanded) {
      const cur = boundExpanded ?? [];
      const next = open ? [...cur, ...values.filter((v) => !cur.includes(v))] : cur.filter((v) => !values.includes(v));
      b.write(node.expanded, next);
      return;
    }
    setLocalExpanded((prev) => {
      const next = new Set(prev ?? topValues);
      for (const v of values) open ? next.add(v) : next.delete(v);
      return next;
    });
  };
  const toggle = (row: Row) => setExpanded([row.value], !row.expanded);

  const select = (row: Row) => {
    if (!selectable) return;
    if (selection === "single") {
      b.write(node.selected, row.value);
      return;
    }
    const cur = Array.isArray(selected) ? selected : [];
    b.write(node.selected, cur.includes(row.value) ? cur.filter((x) => x !== row.value) : [...cur, row.value]);
  };

  // Activate: select where selectable, and dispatch the action with its context bound to this node.
  const activate = (row: Row) => {
    select(row);
    if (node.action) s.dispatch(node.action, row.scope, node.id);
  };

  // Type-ahead: letters typed in quick succession jump to the next label starting with them.
  const typed = useRef({ buffer: "", at: 0 });
  const typeAhead = (char: string) => {
    const now = Date.now();
    const t = typed.current;
    t.buffer = now - t.at < TYPEAHEAD_MS ? t.buffer + char.toLowerCase() : char.toLowerCase();
    t.at = now;
    const find = (prefix: string) => {
      for (let step = 1; step <= rows.length; step++) {
        const j = (focusIndex + step) % rows.length;
        if (rows[j].label.toLowerCase().startsWith(prefix)) return j;
      }
      return -1;
    };
    // The same letter repeated cycles through matches of that letter.
    const single = t.buffer.length > 1 && [...t.buffer].every((c) => c === t.buffer[0]);
    let j = single ? find(t.buffer[0]) : find(t.buffer);
    if (j < 0 && t.buffer.length > 1) j = find(t.buffer[0]);
    if (j >= 0) focusRow(j);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const row = rows[focusIndex];
    if (!row) return;
    let handled = true;
    switch (e.key) {
      case "ArrowDown":
        focusRow(focusIndex + 1);
        break;
      case "ArrowUp":
        focusRow(focusIndex - 1);
        break;
      case "ArrowRight":
        if (row.hasChildren && !row.expanded) toggle(row);
        else if (row.expanded) focusRow(focusIndex + 1);
        break;
      case "ArrowLeft":
        if (row.expanded) toggle(row);
        else if (row.parent >= 0) focusRow(row.parent);
        break;
      case "Home":
        focusRow(0);
        break;
      case "End":
        focusRow(rows.length - 1);
        break;
      case "Enter":
        activate(row);
        break;
      case " ":
        select(row);
        break;
      case "*":
        setExpanded(rows.filter((r) => r.parent === row.parent && r.hasChildren).map((r) => r.value), true);
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeAhead(e.key);
        else handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const caption = b.text(node.label);
  const listStyle: CSSProperties | undefined = virtual ? { paddingTop: start * rowHeight, paddingBottom: (rows.length - end) * rowHeight } : undefined;

  const list = (
    <ul
      ref={listRef}
      role="tree"
      className="pxd-tree-list"
      aria-labelledby={captionId}
      aria-multiselectable={selection === "multiple" ? true : undefined}
      style={listStyle}
      onKeyDown={onKeyDown}
    >
      {rows.slice(start, end).map((row, offset) => {
        const i = start + offset;
        const rowSelected = selectable ? isSelected(row.value) : undefined;
        return (
          <li
            key={row.key}
            role="treeitem"
            className={`pxd-tree-item${rowSelected ? " pxd-tree-item-selected" : ""}`}
            style={{ "--polyxd-tree-depth": row.level - 1 } as CSSProperties}
            data-index={i}
            tabIndex={i === focusIndex ? 0 : -1}
            aria-level={row.level}
            aria-setsize={row.setsize}
            aria-posinset={row.posinset}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            aria-selected={rowSelected}
            onFocus={(e) => {
              if (e.target === e.currentTarget) setFocusKey(row.key);
            }}
            onClick={(e) => {
              e.stopPropagation();
              focusRow(i);
              if (selectable) select(row);
              else if (row.hasChildren) toggle(row);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (node.action) {
                s.dispatch(node.action, row.scope, node.id);
              } else if (row.hasChildren) {
                toggle(row);
              }
            }}
          >
            <ScopeContext.Provider value={row.scope}>
              <div className="pxd-tree-row">
                {row.hasChildren ? (
                  <button
                    type="button"
                    className={`pxd-tree-expander${row.expanded ? " pxd-tree-expander-open" : ""}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      focusRow(i);
                      toggle(row);
                    }}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <Icon name="chevronRight" size={16} />
                  </button>
                ) : (
                  <span className="pxd-tree-expander pxd-tree-expander-leaf" aria-hidden="true" />
                )}
                <span className="pxd-tree-text">{row.label}</span>
                {row.detail !== undefined && <span className="pxd-tree-detail">{row.detail}</span>}
              </div>
            </ScopeContext.Provider>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="pxd-tree" {...useA11y(node)}>
      <div className="pxd-tree-caption" id={captionId}>
        {caption}
      </div>
      {virtual ? (
        <div ref={viewportRef} className="pxd-tree-viewport" onScroll={onScroll}>
          {list}
        </div>
      ) : (
        list
      )}
    </div>
  );
}
