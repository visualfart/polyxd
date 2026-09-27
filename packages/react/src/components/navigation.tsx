import { useContext, useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { FrameContext, useBindings, useSurface, type Node } from "../context.tsx";
import { useA11y } from "../surface.tsx";
import { BAR_MAX, NAV_COMPACT_PX as COMPACT_PX, groupItems, navigationLabel } from "@polyxd/core";
import { Icon } from "./avatar.tsx";


/**
 * Navigation: the product's sections. A side navigation on wide surfaces (grouped, with the
 * current item marked), a menu button that opens them on compact ones. The other kinds sit in
 * the page: a breadcrumb trail, expandable groups, a table of contents, or section tabs.
 * Inside a Frame, the frame's own main navigation takes the placement the frame decided: a
 * side column, a rail, a bottom bar, or a drawer behind the AppBar's menu button.
 */
export function Navigation({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const frame = useContext(FrameContext);
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const kind: string = node.kind ?? "main";
  const placed = frame && frame.navigationId === node.id && kind === "main" ? frame.navigation : undefined;
  // The host marks the current item through PolyxdFrame; otherwise the binding says.
  const bound = b.value<string>(node.current);
  const current = placed && frame?.current?.key !== undefined ? frame.current.key : bound;
  const label = node.label !== undefined ? b.text(node.label) : navigationLabel(kind);
  const a11y = useA11y(node);

  useLayoutEffect(() => {
    if (kind !== "main" || placed) return;
    const el = ref.current?.closest(".pxd-surface") ?? ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setCompact(el.getBoundingClientRect().width < COMPACT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kind, placed]);

  const activate = (item: any) => {
    setOpen(false);
    frame?.setDrawerOpen(false);
    s.dispatch(item.action, b.scope, node.id);
  };
  const badgeOf = (item: any) => {
    const badge = item.badge !== undefined ? b.value<number>(item.badge) : undefined;
    return badge ? (
      <span className="pxd-nav-badge">
        {badge}
        <span className="pxd-sr-only"> needing attention</span>
      </span>
    ) : null;
  };

  if (kind === "breadcrumb") {
    // An ordered trail; the last item is where you are.
    return (
      <nav className="pxd-nav-breadcrumb" aria-label={label} {...a11y}>
        <ol>
          {node.items.map((item: any, i: number) => {
            const last = i === node.items.length - 1;
            const on = item.key === current || (current === undefined && last);
            return (
              <li key={item.key}>
                {on ? (
                  <span className="pxd-nav-breadcrumb-current" aria-current="page">
                    {b.text(item.label)}
                  </span>
                ) : (
                  <button type="button" className="pxd-link" onClick={() => activate(item)}>
                    {b.text(item.label)}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  if (kind === "toc") {
    // Anchors to the page's sections, named by their keys; the section in view is marked.
    return (
      <nav className="pxd-nav-toc" aria-label={label} {...a11y}>
        <p className="pxd-nav-toc-label" aria-hidden="true">
          {label}
        </p>
        <ol>
          {node.items.map((item: any) => {
            const on = item.key === current;
            return (
              <li key={item.key}>
                <a href={`#${item.key}`} className={`pxd-nav-toc-link${on ? " pxd-nav-current" : ""}`} aria-current={on ? "true" : undefined} onClick={() => s.dispatch(item.action, b.scope, node.id)}>
                  {b.text(item.label)}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  if (kind === "local") {
    // Sections of one area, as tabs.
    return (
      <nav className="pxd-nav-local" aria-label={label} {...a11y}>
        <ul>
          {node.items.map((item: any) => {
            const on = item.key === current;
            return (
              <li key={item.key}>
                <button type="button" className={`pxd-nav-local-item${on ? " pxd-nav-current" : ""}`} aria-current={on ? "page" : undefined} onClick={() => activate(item)}>
                  {item.icon && <Icon name={item.icon} size={16} />}
                  <span className="pxd-nav-label">{b.text(item.label)}</span>
                  {badgeOf(item)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const groups = groupItems<any>(node.items, b.text);
  const nested = kind === "nested";
  const isOpen = (g: { label?: string; items: any[] }) => (g.label && g.label in toggled ? toggled[g.label] : !g.label || g.items.some((item) => item.key === current));

  const items = (list: any[]) => (
    <ul>
      {list.map((item: any) => {
        const on = item.key === current;
        return (
          <li key={item.key}>
            <button type="button" className={`pxd-nav-item${on ? " pxd-nav-current" : ""}`} aria-current={on ? "page" : undefined} onClick={() => activate(item)}>
              {item.icon && <Icon name={item.icon} size={18} />}
              <span className="pxd-nav-label">{b.text(item.label)}</span>
              {badgeOf(item)}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const list = (
    <nav className={`pxd-nav${nested ? " pxd-nav-nested" : ""}${placed === "side" ? " pxd-nav-side" : ""}`} aria-label={label} {...(placed === "side" ? a11y : {})}>
      {groups.map((g, gi) => (
        <div className="pxd-nav-group" key={gi}>
          {g.label &&
            (nested ? (
              <button type="button" className="pxd-nav-group-toggle" aria-expanded={isOpen(g)} onClick={() => setToggled((t) => ({ ...t, [g.label!]: !isOpen(g) }))}>
                <Icon name={isOpen(g) ? "sortUp" : "sortDown"} size={16} />
                <span className="pxd-nav-group-label">{g.label}</span>
              </button>
            ) : (
              <p className="pxd-nav-group-label">{g.label}</p>
            ))}
          {(!nested || isOpen(g)) && items(g.items)}
        </div>
      ))}
    </nav>
  );

  if (placed === "side") return list;

  if (placed === "rail" || placed === "bar") {
    // Icon over label, the current item marked, the badge on the icon. Groups don't fit; a bar shows five at most.
    const shown = placed === "bar" ? node.items.slice(0, BAR_MAX) : node.items;
    return (
      <nav className={`pxd-nav-${placed}`} aria-label={label} {...a11y}>
        <ul>
          {shown.map((item: any) => {
            const on = item.key === current;
            const text = b.text(item.label);
            return (
              <li key={item.key}>
                <button type="button" className={`pxd-nav-${placed}-item${on ? " pxd-nav-current" : ""}`} aria-current={on ? "page" : undefined} onClick={() => activate(item)}>
                  <span className={`pxd-nav-${placed}-icon`}>
                    {item.icon ? (
                      <Icon name={item.icon} size={24} />
                    ) : (
                      <span className="pxd-nav-glyph" aria-hidden="true">
                        {text.slice(0, 1)}
                      </span>
                    )}
                    {badgeOf(item)}
                  </span>
                  <span className="pxd-nav-label">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  if (placed === "drawer" && frame) {
    // The AppBar's menu button opens it; the Frame holds the state so the button can report it.
    return (
      <Dialog.Root open={frame.drawerOpen} onOpenChange={frame.setDrawerOpen}>
        <Dialog.Portal container={s.portal}>
          <Dialog.Overlay className="pxd-overlay" />
          <Dialog.Content className="pxd-nav-drawer" aria-describedby={undefined} {...a11y}>
            <div className="pxd-sheet-header">
              <Dialog.Title className="pxd-sheet-title">{label}</Dialog.Title>
              <Dialog.Close className="pxd-icon-button" aria-label="Close">
                <Icon name="close" />
              </Dialog.Close>
            </div>
            {list}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <div ref={ref} className="pxd-nav-wrap" {...a11y}>
      {compact ? (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="pxd-icon-button pxd-nav-menu" aria-label={`${label} menu`}>
            <Icon name="menu" />
          </Dialog.Trigger>
          <Dialog.Portal container={s.portal}>
            <Dialog.Overlay className="pxd-overlay" />
            <Dialog.Content className="pxd-nav-drawer" aria-describedby={undefined}>
              <div className="pxd-sheet-header">
                <Dialog.Title className="pxd-sheet-title">{label}</Dialog.Title>
                <Dialog.Close className="pxd-icon-button" aria-label="Close">
                  <Icon name="close" />
                </Dialog.Close>
              </div>
              {list}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : (
        list
      )}
    </div>
  );
}
