/**
 * The document as a tree: the root and everything it reaches, then what sits outside it (the
 * header's actions, a navigation, strays). Each row says what the component is and what it shows.
 */
import { useMemo, useState } from "react";
import catalog from "@polyxd/spec/catalog/catalog.json" with { type: "json" };
import { COMPONENTS, FRAME_REGIONS, SHELL_COMPONENTS, allowedIn, belongsInShell, isShell, pickableIn, refProps, type Doc, type Node } from "../../screens/schema.ts";
import { buildTree, parentOf, type TreeItem } from "../../screens/tree.ts";

const CATALOG = (catalog as { components: Record<string, { summary: string; category: string }> }).components;
const CATEGORIES = ["shell", "structure", "layout", "content", "input", "action", "feedback", "flow"];

/** What a row says after the component's name: its label, title, text or caption. */
export function summaryOf(node: Node): string {
  for (const p of ["label", "title", "text", "caption", "summary", "name"]) {
    const v = node[p];
    if (typeof v === "string" && v) return v;
    if (v && typeof v === "object" && typeof v.path === "string") return `{${v.path}}`;
  }
  if (node.component === "Action" && node.action?.event?.name) return node.action.event.name;
  return "";
}

export interface Target {
  parentId: string;
  prop: string;
  index?: number;
}

/** Where a new component goes for a selection: into its first list slot, else after it in its parent's list. */
export function targetFor(doc: Doc, selected: string | null): Target | null {
  const node = doc.components.find((c) => c.id === selected);
  if (!node) return { parentId: doc.root, prop: refProps(doc.components.find((c) => c.id === doc.root)?.component ?? "")[0]?.prop ?? "children" };
  const list = refProps(node.component).find((r) => r.kind === "list");
  if (list) return { parentId: node.id, prop: list.prop };
  const at = parentOf(doc, node.id);
  if (at && at.slot.kind === "list" && at.slot.index !== undefined) return { parentId: at.parent.id, prop: at.slot.prop, index: at.slot.index + 1 };
  return null;
}

export function Tree({ doc, selected, issues, onSelect, onAdd, onRemove, onMove, onDuplicate }: { doc: Doc; selected: string | null; issues: Map<string, "error" | "warning">; onSelect: (id: string) => void; onAdd: (target: Target) => void; onRemove: (id: string) => void; onMove: (id: string, by: -1 | 1) => void; onDuplicate: (id: string) => void }) {
  const tree = useMemo(() => buildTree(doc), [doc]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const row = (item: TreeItem, depth: number) => {
    const isSel = item.id === selected;
    const tone = issues.get(item.id);
    const canList = refProps(item.node.component).some((r) => r.kind === "list");
    const at = parentOf(doc, item.id);
    const inList = at?.slot.kind === "list";
    return (
      <div key={item.id}>
        <div className="scr-node" role="treeitem" tabIndex={isSel ? 0 : -1} aria-selected={isSel} aria-expanded={item.children.length ? !collapsed.has(item.id) : undefined} aria-label={`${item.node.component} ${item.id}`} data-selected={isSel} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => onSelect(item.id)} onFocus={() => !isSel && onSelect(item.id)}>
          {item.children.length || item.node.component === "Frame" ? <button type="button" className="scr-caret-btn" aria-label={collapsed.has(item.id) ? "Expand" : "Collapse"} onClick={(e) => { e.stopPropagation(); toggle(item.id); }}><span className="scr-caret" data-open={!collapsed.has(item.id)} aria-hidden="true" /></button> : <span className="scr-caret-gap" />}
          <span className="scr-node-main">
            {item.slot && item.slot.prop !== "children" && <span className="scr-slot" title={`In ${item.slot.prop}`}>{item.slot.kind === "panels" && item.slot.label ? item.slot.label : (at?.parent.component === "Frame" && FRAME_REGIONS.find((r) => r.prop === item.slot!.prop)?.label) || item.slot.prop}</span>}
            <span className="scr-node-type">{item.node.component}</span>
            <span className="scr-node-text">{summaryOf(item.node)}</span>
          </span>
          {tone && <span className={`dot ${tone === "error" ? "bad" : "warn"}`} title={tone === "error" ? "Has an error" : "Has a warning"} />}
          <span className="scr-node-actions" onClick={(e) => e.stopPropagation()}>
            {canList && <button type="button" className="scr-x" title="Add a child" aria-label={`Add a child to ${item.id}`} onClick={() => onAdd({ parentId: item.id, prop: refProps(item.node.component).find((r) => r.kind === "list")!.prop })}>+</button>}
            {inList && <button type="button" className="scr-x" title="Duplicate (⌘D)" aria-label={`Duplicate ${item.id}`} onClick={() => onDuplicate(item.id)}>⧉</button>}
            {inList && <button type="button" className="scr-x" title="Move up (⌥↑)" aria-label={`Move ${item.id} up`} disabled={at!.slot.index === 0} onClick={() => onMove(item.id, -1)}>↑</button>}
            {inList && <button type="button" className="scr-x" title="Move down (⌥↓)" aria-label={`Move ${item.id} down`} onClick={() => onMove(item.id, 1)}>↓</button>}
            {item.id !== doc.root && <button type="button" className="scr-x" title="Delete (⌫)" aria-label={`Delete ${item.id}`} onClick={() => onRemove(item.id)}>×</button>}
          </span>
        </div>
        {!collapsed.has(item.id) && (item.children.length > 0 || item.node.component === "Frame") && (
          <div role="group">
            {item.children.map((c) => row(c, depth + 1))}
            {item.node.component === "Frame" && FRAME_REGIONS.filter((r) => typeof item.node[r.prop] !== "string").map((r) => (
              <div key={r.prop} className="scr-node scr-node-empty" role="treeitem" aria-selected={false} aria-label={`${r.label}: empty`} style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
                <span className="scr-caret-gap" />
                <span className="scr-node-main"><span className="scr-slot" title={`The Frame's ${r.prop}`}>{r.label}</span><span className="scr-node-text">{r.prop === "main" ? "nothing: a shell needs its Outlet here" : "empty"}</span></span>
                <span className="scr-node-actions" style={{ display: "inline-flex" }}><button type="button" className="scr-x" title={`Add the ${r.label.toLowerCase()}`} aria-label={`Add the ${r.label.toLowerCase()}`} onClick={() => onAdd({ parentId: item.id, prop: r.prop })}>+</button></span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="scr-tree-body" role="tree" aria-label="Components">
      {tree.root ? row(tree.root, 0) : <p className="muted small" style={{ padding: 12 }}>The root “{doc.root}” isn't a component. Fix it in the JSON tab.</p>}
      {tree.others.length > 0 && (
        <>
          <div className="scr-tree-group">Outside the root</div>
          {tree.others.map((t) => row(t, 0))}
        </>
      )}
    </div>
  );
}

/** The 37 components by category, filtered to what the slot allows, with the spec's one-line summary. */
export function Picker({ doc, target, onPick, onClose }: { doc: Doc; target: Target; onPick: (component: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const parent = doc.components.find((c) => c.id === target.parentId);
  const slot = parent ? allowedIn(parent.component, target.prop) : COMPONENTS;
  // A surface never takes a shell part; the validator would refuse it, so the picker says so first.
  const allowed = pickableIn(doc, slot);
  const refused = isShell(doc) ? [] : slot.filter((c) => SHELL_COMPONENTS.includes(c));
  const matches = (c: string) => !q || `${c} ${CATALOG[c]?.summary ?? ""} ${CATALOG[c]?.category ?? ""}`.toLowerCase().includes(q.toLowerCase());
  const shown = COMPONENTS.filter((c) => allowed.includes(c) && matches(c));
  const shownRefused = refused.filter(matches);
  // Enter takes the name that matches, before a summary that happens to contain the letters.
  const needle = q.trim().toLowerCase();
  const best = shown.find((c) => c.toLowerCase() === needle) ?? shown.find((c) => c.toLowerCase().startsWith(needle)) ?? shown.find((c) => c.toLowerCase().includes(needle)) ?? shown[0];
  const where = parent ? `${parent.component} ${parent.id} › ${target.prop}${target.index !== undefined ? ` at ${target.index + 1}` : ""}` : "";
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="dialog scr-picker" role="dialog" aria-modal="true" aria-label="Add a component">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flexGrow: 1 }}><h2>Add a component</h2><p className="small muted">Into {where}. {allowed.length < COMPONENTS.length ? `This slot takes ${allowed.length === 1 ? allowed[0] : `${allowed.length} kinds of component`}.` : ""}</p></div>
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </div>
        <input className="input" placeholder="Search components" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Search components" onKeyDown={(e) => e.key === "Enter" && best && onPick(best)} />
        <div className="scr-picker-list">
          {CATEGORIES.map((cat) => {
            const items = shown.filter((c) => CATALOG[c]?.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="scr-tree-group">{cat}</div>
                {items.map((c) => (
                  <button type="button" key={c} className="scr-pick" onClick={() => onPick(c)}><b>{c}</b><span>{CATALOG[c]?.summary}</span></button>
                ))}
              </div>
            );
          })}
          {shownRefused.length > 0 && (
            <div>
              <div className="scr-tree-group">shell · not in a surface</div>
              {shownRefused.map((c) => (
                <button type="button" key={c} className="scr-pick" disabled aria-disabled="true" title={belongsInShell(c)} style={{ opacity: 0.55, cursor: "not-allowed" }}><b>{c}</b><span>{belongsInShell(c)}</span></button>
              ))}
            </div>
          )}
          {!shown.length && !shownRefused.length && <p className="muted small" style={{ padding: 12 }}>Nothing matches.</p>}
        </div>
      </div>
    </>
  );
}
