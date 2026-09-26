import { createElement, useContext, useId, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import { ContextMenu, Dialog, DropdownMenu, Popover } from "radix-ui";
import { HeadingContext, useBindings, useSurface, type Node } from "../context.tsx";
import { Render, useA11y } from "../surface.tsx";
import { Children } from "./structure.tsx";
import { Icon } from "./avatar.tsx";

/** Whether a Dynamic* value is a binding (rather than a literal). */
const isBinding = (v: unknown): v is { path: string } => typeof v === "object" && v !== null && typeof (v as any).path === "string";

/** A downward chevron: the one glyph the icon set lacks. */
function Chevron() {
  return (
    <svg className="pxd-action-menu-chevron" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The parts of a Radix menu that DropdownMenu and ContextMenu share. */
type MenuParts = { Item: ComponentType<any>; Separator: ComponentType<any> };

/**
 * Secondary actions behind one control. The children are Actions; each becomes a menu item that
 * dispatches that Action. A danger-toned Action goes last, after a divider. `context` also renders
 * an overflow control, since right-click and long-press are not discoverable.
 */
export function ActionMenu({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const a11y = useA11y(node);
  const kind: string = node.kind ?? "overflow";
  const label = b.text(node.label);
  // accessibility.label, when the author set one, wins over the control's own label.
  const name = (a11y["aria-label"] as string | undefined) ?? label;

  const actions: Node[] = (node.children ?? [])
    .map((id: string) => s.byId.get(id))
    .filter((c: Node | undefined): c is Node => Boolean(c) && (c!.visible === undefined || b.value(c!.visible) !== false));
  const usual = actions.filter((a) => a.tone !== "danger");
  const danger = actions.filter((a) => a.tone === "danger");

  const items = (M: MenuParts) => {
    const item = (a: Node) => (
      <M.Item
        key={a.id}
        className={`pxd-menu-item${a.tone === "danger" ? " pxd-menu-item-danger" : ""}`}
        disabled={a.disabled !== undefined ? Boolean(b.value(a.disabled)) : undefined}
        onSelect={() => s.dispatch(a.action, b.scope, a.id)}
        data-pxd-id={a.id}
        data-pxd-component={a.component}
      >
        {b.text(a.label)}
      </M.Item>
    );
    return (
      <>
        {usual.map(item)}
        {danger.length > 0 && usual.length > 0 && <M.Separator className="pxd-menu-separator" />}
        {danger.map(item)}
      </>
    );
  };

  const overflowTrigger = (
    <DropdownMenu.Trigger className="pxd-icon-button pxd-action-menu-trigger pxd-action-menu-overflow" {...a11y} aria-label={name}>
      <Icon name="dots" size={18} />
    </DropdownMenu.Trigger>
  );

  const menu = (
    <DropdownMenu.Portal container={s.portal}>
      <DropdownMenu.Content className="pxd-menu pxd-action-menu" align="end" sideOffset={4}>
        {items(DropdownMenu)}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );

  if (kind === "dropdown")
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="pxd-button pxd-button-secondary pxd-action-menu-trigger pxd-action-menu-dropdown" {...a11y} aria-label={a11y["aria-label"] as string | undefined}>
          {label}
          <Chevron />
        </DropdownMenu.Trigger>
        {menu}
      </DropdownMenu.Root>
    );

  if (kind === "split") {
    // The menu part takes the primary's emphasis so the two read as one control.
    const primary = node.primary ? s.byId.get(node.primary) : undefined;
    const emphasis = primary?.emphasis ?? "secondary";
    return (
      <DropdownMenu.Root>
        <div className="pxd-split" role="group" {...a11y} aria-label={name}>
          {node.primary && <Render id={node.primary} />}
          <DropdownMenu.Trigger className={`pxd-button pxd-button-${emphasis} pxd-action-menu-trigger pxd-split-menu`} aria-label={`${label}: more options`}>
            <Chevron />
          </DropdownMenu.Trigger>
        </div>
        {menu}
      </DropdownMenu.Root>
    );
  }

  if (kind === "context")
    return (
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <span className="pxd-context-target">
            <DropdownMenu.Root>
              {overflowTrigger}
              {menu}
            </DropdownMenu.Root>
          </span>
        </ContextMenu.Trigger>
        <ContextMenu.Portal container={s.portal}>
          <ContextMenu.Content className="pxd-menu pxd-action-menu" aria-label={name}>
            {items(ContextMenu)}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    );

  return (
    <DropdownMenu.Root>
      {overflowTrigger}
      {menu}
    </DropdownMenu.Root>
  );
}

/** Drag a bottom sheet down to dismiss it. Handlers go on the header; the transform on the sheet. */
function useDragDown(enabled: boolean, sheet: React.RefObject<HTMLDivElement | null>, onDismiss: () => void) {
  const start = useRef<number | null>(null);
  const reset = () => {
    start.current = null;
    if (sheet.current) {
      sheet.current.style.transform = "";
      sheet.current.style.transition = "";
    }
  };
  if (!enabled) return {};
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      if (start.current === null || !sheet.current) return;
      const dy = Math.max(0, e.clientY - start.current);
      sheet.current.style.transition = "none";
      sheet.current.style.transform = `translateY(${dy}px)`;
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      if (start.current === null) return;
      const dy = e.clientY - start.current;
      reset();
      if (dy > 80) onDismiss();
    },
    onPointerCancel: reset,
  };
}

/**
 * Content over the current view. `open` may be bound to host data (the renderer writes false on
 * dismiss); absent, the panel is open until dismissed. Dismissal also dispatches ui.dismiss, like
 * Confirm. dialog, drawer and sheet are modal (Radix Dialog); popover is a non-modal Radix Popover
 * anchored where the Panel sits in the tree.
 */
export function Panel({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const a11y = useA11y(node);
  const level = Math.min(useContext(HeadingContext), 6);
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const kind: string = node.kind ?? "dialog";
  const size: string = node.size ?? "default";
  const dismissible = node.dismissible !== false;
  const bound = isBinding(node.open);
  const [local, setLocal] = useState(true);
  const open = bound ? Boolean(b.value(node.open)) : local && node.open !== false;

  const close = () => {
    if (bound) b.write(node.open, false);
    else setLocal(false);
    s.dispatch({ event: { name: "ui.dismiss" } }, b.scope, node.id);
  };
  const onOpenChange = (o: boolean) => {
    if (!o) close();
  };
  // A panel that must be completed ignores Escape and the backdrop.
  const guard = dismissible ? {} : { onEscapeKeyDown: (e: Event) => e.preventDefault(), onInteractOutside: (e: Event) => e.preventDefault() };
  const drag = useDragDown(kind === "sheet" && dismissible, sheetRef, close);

  const title = b.text(node.title);
  const className = `pxd-panel pxd-panel-${kind} pxd-panel-size-${size}`;
  const body = (
    <HeadingContext.Provider value={level + 1}>
      <div className="pxd-panel-body pxd-stack">
        <Children ids={node.children} />
      </div>
    </HeadingContext.Provider>
  );
  const footer = node.actions && (
    <div className="pxd-panel-footer">
      <Render id={node.actions} />
    </div>
  );

  if (kind === "popover")
    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Anchor className="pxd-panel-anchor" />
        <Popover.Portal container={s.portal}>
          <Popover.Content className={className} aria-labelledby={titleId} sideOffset={8} collisionPadding={8} {...guard} {...a11y}>
            <div className="pxd-panel-header">
              {createElement(`h${level}`, { id: titleId, className: "pxd-panel-title" }, title)}
              {dismissible && (
                <Popover.Close className="pxd-icon-button pxd-panel-close" aria-label="Close">
                  <Icon name="close" />
                </Popover.Close>
              )}
            </div>
            {body}
            {footer}
            <Popover.Arrow className="pxd-panel-arrow" width={16} height={8} />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={s.portal}>
        <Dialog.Overlay className="pxd-overlay pxd-panel-backdrop" />
        <Dialog.Content ref={sheetRef} className={className} aria-describedby={undefined} {...guard} {...a11y}>
          <div className="pxd-panel-header" {...drag}>
            {kind === "sheet" && <span className="pxd-panel-grip" aria-hidden="true" />}
            <Dialog.Title asChild>{createElement(`h${level}`, { className: "pxd-panel-title" }, title)}</Dialog.Title>
            {dismissible && (
              <Dialog.Close className="pxd-icon-button pxd-panel-close" aria-label="Close">
                <Icon name="close" />
              </Dialog.Close>
            )}
          </div>
          {body}
          {footer}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
