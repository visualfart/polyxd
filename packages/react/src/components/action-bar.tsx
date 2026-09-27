import { useLayoutEffect, useRef, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { useBindings, useSurface, type Node } from "../context.tsx";
import { Render, useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";

/** What the overflow control is called; also what a task runner looks for. */
const MORE = "More actions";

/** The trigger's width before it has been drawn: size.target.min in every pack. */
const TRIGGER_FALLBACK = 44;

/**
 * Children are in order of importance; CSS places the primary where each layout expects it.
 * In the wide (row) layout, actions that would wrap onto a second line fold into a "More actions"
 * menu, least important first. The first child never folds, two actions never fold, and the
 * stacked layout keeps everything as buttons. Widths are measured from buttons as they are drawn
 * and remembered, so a folded action is never rendered twice (a task runner finds buttons by
 * label) and folding never changes what is measured.
 */
export function ActionBar({ node }: { node: Node }) {
  const s = useSurface();
  const ids: string[] = node.children ?? [];
  const bar = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const widths = useRef(new Map<string, number>());
  const triggerWidth = useRef(TRIGGER_FALLBACK);
  const lastWidth = useRef(-1);
  // How many children are buttons; the rest are menu items. The server shows them all.
  const [shown, setShown] = useState(ids.length);
  // Only a trailing run of Actions can fold; anything else (a menu, a split) stays put.
  const isAction = (id: string) => s.byId.get(id)?.component === "Action";
  let minShown = 1;
  for (let i = ids.length - 1; i > 0; i--) if (!isAction(ids[i])) { minShown = i + 1; break; }

  const fit = () => {
    const el = bar.current;
    if (!el) return;
    if (ids.length <= 2 || getComputedStyle(el).flexDirection === "column") return setShown(ids.length);
    for (const child of el.querySelectorAll<HTMLElement>(":scope > [data-pxd-id]")) {
      if (child.offsetWidth) widths.current.set(child.dataset.pxdId!, child.offsetWidth);
    }
    if (trigger.current?.offsetWidth) triggerWidth.current = trigger.current.offsetWidth;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const room = el.clientWidth;
    // An unmeasured child counts as nothing wide, so it is drawn, measured, and fitted next pass.
    const width = (id: string) => widths.current.get(id) ?? 0;
    let used = 0;
    let n = 0;
    while (n < ids.length && used + (n ? gap : 0) + width(ids[n]) <= room) used += (n ? gap : 0) + width(ids[n++]);
    if (n < ids.length) {
      // Make room for the trigger itself, giving up the least important buttons first.
      while (n > minShown && used + gap + triggerWidth.current > room) used -= gap + width(ids[--n]);
      n = Math.max(n, minShown);
    }
    setShown(n);
  };

  useLayoutEffect(fit);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w === lastWidth.current) return; // height changes as rows wrap; only width matters here
      lastWidth.current = w;
      fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  const visible = ids.slice(0, Math.min(shown, ids.length));
  const folded = ids.slice(visible.length);
  return (
    <div ref={bar} className="pxd-action-bar" role="group" aria-label="Actions" {...useA11y(node)}>
      {visible.map((id) => (
        <Render key={id} id={id} />
      ))}
      {folded.length > 0 && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger ref={trigger} className="pxd-icon-button pxd-action-menu-trigger pxd-action-menu-overflow pxd-action-bar-more" aria-label={MORE}>
            <Icon name="dots" size={18} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal container={s.portal}>
            <DropdownMenu.Content className="pxd-menu pxd-action-menu" align="start" sideOffset={4}>
              <ActionItems ids={folded} />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

/** Actions as dropdown items, the same way ActionMenu draws them: danger last, after a divider. */
export function ActionItems({ ids }: { ids: string[] }) {
  const b = useBindings();
  const s = useSurface();
  const actions = ids
    .map((id) => s.byId.get(id))
    .filter((a): a is Node => Boolean(a) && a!.component === "Action" && (a!.visible === undefined || b.value(a!.visible) !== false));
  const usual = actions.filter((a) => a.tone !== "danger");
  const danger = actions.filter((a) => a.tone === "danger");
  const item = (a: Node) => (
    <DropdownMenu.Item
      key={a.id}
      className={`pxd-menu-item${a.tone === "danger" ? " pxd-menu-item-danger" : ""}`}
      disabled={a.disabled !== undefined ? Boolean(b.value(a.disabled)) : undefined}
      onSelect={() => s.dispatch(a.action, b.scope, a.id)}
      data-pxd-id={a.id}
      data-pxd-component={a.component}
    >
      {b.text(a.label)}
    </DropdownMenu.Item>
  );
  return (
    <>
      {usual.map(item)}
      {danger.length > 0 && usual.length > 0 && <DropdownMenu.Separator className="pxd-menu-separator" />}
      {danger.map(item)}
    </>
  );
}
