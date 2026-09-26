import { useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { useBindings, useSurface, type Node } from "../context.tsx";
import { useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";

/** Below this width the navigation moves behind a menu button. */
const COMPACT_PX = 900;

/**
 * Navigation: the product's sections. A side navigation on wide surfaces (grouped, with the
 * current item marked), a menu button that opens them on compact ones. The other kinds sit in
 * the page: a breadcrumb trail, expandable groups, a table of contents, or section tabs.
 */
export function Navigation({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const current = b.value<string>(node.current);
  const kind: string = node.kind ?? "main";
  const label = node.label !== undefined ? b.text(node.label) : kind === "breadcrumb" ? "Breadcrumb" : kind === "toc" ? "On this page" : "Main";
  const a11y = useA11y(node);

  useLayoutEffect(() => {
    if (kind !== "main") return;
    const el = ref.current?.closest(".pxd-surface") ?? ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setCompact(el.getBoundingClientRect().width < COMPACT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kind]);

  const activate = (item: any) => {
    setOpen(false);
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

  // Items under their group headings, in first-seen order.
  const groups: { label?: string; items: any[] }[] = [];
  for (const item of node.items) {
    const g = item.group !== undefined ? b.text(item.group) : undefined;
    const found = groups.find((x) => x.label === g);
    if (found) found.items.push(item);
    else groups.push({ label: g, items: [item] });
  }
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
    <nav className={`pxd-nav${nested ? " pxd-nav-nested" : ""}`} aria-label={label}>
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
