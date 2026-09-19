import { useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { useBindings, useSurface, type Node } from "../context.tsx";
import { useA11y } from "../surface.tsx";
import { Icon } from "./avatar.tsx";

/** Below this width the navigation moves behind a menu button. */
const COMPACT_PX = 900;

/**
 * Navigation: the product's sections. A side navigation on wide surfaces (grouped, with the
 * current item marked), a menu button that opens them on compact ones.
 */
export function Navigation({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const current = b.value<string>(node.current);
  const label = node.label !== undefined ? b.text(node.label) : "Main";

  useLayoutEffect(() => {
    const el = ref.current?.closest(".pxd-surface") ?? ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setCompact(el.getBoundingClientRect().width < COMPACT_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Items under their group headings, in first-seen order.
  const groups: { label?: string; items: any[] }[] = [];
  for (const item of node.items) {
    const g = item.group !== undefined ? b.text(item.group) : undefined;
    const found = groups.find((x) => x.label === g);
    if (found) found.items.push(item);
    else groups.push({ label: g, items: [item] });
  }

  const list = (
    <nav className="pxd-nav" aria-label={label}>
      {groups.map((g, gi) => (
        <div className="pxd-nav-group" key={gi}>
          {g.label && <p className="pxd-nav-group-label">{g.label}</p>}
          <ul>
            {g.items.map((item: any) => {
              const badge = item.badge !== undefined ? b.value<number>(item.badge) : undefined;
              const on = item.key === current;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={`pxd-nav-item${on ? " pxd-nav-current" : ""}`}
                    aria-current={on ? "page" : undefined}
                    onClick={() => {
                      setOpen(false);
                      s.dispatch(item.action, b.scope, node.id);
                    }}
                  >
                    {item.icon && <Icon name={item.icon} size={18} />}
                    <span className="pxd-nav-label">{b.text(item.label)}</span>
                    {badge ? (
                      <span className="pxd-nav-badge">
                        {badge}
                        <span className="pxd-sr-only"> needing attention</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div ref={ref} className="pxd-nav-wrap" {...useA11y(node)}>
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
