import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, asList, childPointer, get, resolve } from "../data.ts";
import { Render, useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";

/** Below this surface width the detail replaces the list instead of sitting beside it. */
const COMPACT_PX = 640;
/** The list's share of the width, by ratio, and how far a resizable handle may move it. */
const SHARE: Record<string, number> = { narrow: 33.333, balanced: 50, wide: 66.667 };
const SHARE_MIN = 20;
const SHARE_MAX = 80;

/** The value the primary selects an item by: its id when it has one, else its index (as Collection and Table do). */
const itemValue = (item: unknown, index: number, valuePath: string | undefined, data: unknown, pointer: string) =>
  valuePath ? get(data, absolute(valuePath, { pointer })) : item && typeof item === "object" && "id" in item ? (item as { id: unknown }).id : index;

/**
 * Master and detail. The primary (a Collection or Table with single selection) and the Split
 * share the `selected` binding; the detail renders in the selected item's scope, so its
 * relative bindings read that item. Wide: two panes, the list scrolling on its own. Compact:
 * the list, then the detail as a page with a Back control, focus on the detail and the item's
 * name announced. The list stays mounted throughout, keeping its scroll position and selection.
 */
export function Split({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const a11y = useA11y(node);
  const ref = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  // Back on compact shows the list again without dropping the selection.
  const [listShown, setListShown] = useState(false);
  const [share, setShare] = useState<number>(SHARE[node.ratio ?? "narrow"] ?? SHARE.narrow);

  useLayoutEffect(() => {
    const el = ref.current?.closest(".pxd-surface") ?? ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setCompact(el.getBoundingClientRect().width < COMPACT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selected = b.value<unknown>(node.selected);
  const has = selected !== undefined && selected !== null && selected !== "";
  const primary = s.byId.get(node.primary);
  const listPath: unknown = primary?.component === "Table" ? primary.rows?.path : primary?.items?.path;
  const pointer = typeof listPath === "string" ? absolute(listPath, b.scope) : undefined;
  const items = pointer ? asList(get(s.data, pointer)) : [];
  const index = pointer ? items.findIndex((item, i) => itemValue(item, i, primary?.rowValuePath, s.data, childPointer(pointer, i)) === selected) : -1;
  const scope = pointer && index >= 0 ? { pointer: childPointer(pointer, index) } : undefined;
  // The item's name, for the announcement: what the list shows as its title, else a name-like field.
  const template = primary?.items?.componentId ? s.byId.get(primary.items.componentId) : undefined;
  const item = index >= 0 ? (items[index] as Record<string, unknown> | undefined) : undefined;
  const titled = scope && template?.title !== undefined ? resolve(template.title, s.data, scope) : undefined;
  const name = has ? String(titled ?? item?.name ?? item?.title ?? item?.label ?? selected) : undefined;

  // A new selection shows its detail; on compact it takes the screen and focus.
  const previous = useRef(selected);
  useEffect(() => {
    if (selected === previous.current) return;
    previous.current = selected;
    setListShown(false);
    if (compact && has) detailRef.current?.focus();
  }, [selected, compact, has]);

  const showDetail = !compact || (has && !listShown);
  const showList = !compact || !showDetail;

  const clamp = (v: number) => Math.min(SHARE_MAX, Math.max(SHARE_MIN, v));
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5;
    const next = e.key === "ArrowLeft" ? share - step : e.key === "ArrowRight" ? share + step : e.key === "Home" ? SHARE_MIN : e.key === "End" ? SHARE_MAX : undefined;
    if (next === undefined) return;
    e.preventDefault();
    setShare(clamp(next));
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const move = (ev: PointerEvent) => {
      const x = rtl ? rect.right - ev.clientX : ev.clientX - rect.left;
      setShare(clamp((x / rect.width) * 100));
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

  const resizable = Boolean(node.resizable) && !compact;
  const style = resizable ? ({ "--polyxd-split-share": `${share}%` } as CSSProperties) : undefined;
  return (
    <div ref={ref} className={`pxd-split pxd-split-${node.ratio ?? "narrow"}${compact ? " pxd-split-compact" : ""}${resizable ? " pxd-split-resizable" : ""}`} style={style} {...a11y}>
      <div className="pxd-split-primary" hidden={!showList}>
        <Render id={node.primary} />
      </div>
      {resizable && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the list"
          aria-valuenow={Math.round(share)}
          aria-valuemin={SHARE_MIN}
          aria-valuemax={SHARE_MAX}
          tabIndex={0}
          className="pxd-split-handle"
          onKeyDown={onKey}
          onPointerDown={onPointerDown}
        >
          <span className="pxd-split-handle-line" aria-hidden="true" />
        </div>
      )}
      {showDetail && (
        <div ref={detailRef} className="pxd-split-detail" tabIndex={-1} aria-label={name}>
          {compact && (
            <button type="button" className="pxd-button pxd-button-tertiary pxd-split-back" onClick={() => setListShown(true)}>
              <Icon name="chevronLeft" size={18} />
              Back
            </button>
          )}
          {has ? <Render id={node.detail} scope={scope} /> : node.empty ? <Render id={node.empty} /> : null}
        </div>
      )}
      <span className="pxd-sr-only" aria-live="polite">
        {compact && has && !listShown ? name : ""}
      </span>
    </div>
  );
}
