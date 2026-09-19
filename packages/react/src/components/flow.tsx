import { useContext, useEffect, useId, useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import { StepsContext, resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, childPointer, get } from "../data.ts";
import { formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Heading } from "./structure.tsx";
import { Avatar, Icon } from "./avatar.tsx";

export function Action({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const steps = useContext(StepsContext);
  const disabled = node.disabled !== undefined ? Boolean(b.value(node.disabled)) : false;
  const tone = node.tone === "danger" ? " pxd-button-danger" : "";
  const onClick = () => {
    const name = node.action.event.name;
    if (name === "ui.back" && steps) return steps.back();
    if (name === "ui.next" && steps) return steps.next();
    s.dispatch(node.action, b.scope, node.id);
  };
  return (
    <button type="button" className={`pxd-button pxd-button-${node.emphasis ?? "secondary"}${tone}`} disabled={disabled} onClick={onClick} {...useA11y(node)}>
      {b.text(node.label)}
    </button>
  );
}

/** Children are in order of importance; CSS places the primary where each layout expects it. */
export function ActionBar({ node }: { node: Node }) {
  return (
    <div className="pxd-action-bar" role="group" aria-label="Actions" {...useA11y(node)}>
      {node.children.map((id: string) => (
        <Render key={id} id={id} />
      ))}
    </div>
  );
}

export function Steps({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const bound = node.current !== undefined ? b.value<number>(node.current) : undefined;
  const [local, setLocal] = useState<number>(typeof bound === "number" ? bound : 0);
  const index = typeof bound === "number" && node.current?.path ? bound : local;
  const total = node.steps.length;
  const go = (i: number) => {
    const next = Math.max(0, Math.min(total - 1, i));
    if (node.current?.path) b.write(node.current, next);
    else setLocal(next);
  };
  const step = node.steps[index];
  const last = index === total - 1;
  return (
    <StepsContext.Provider value={{ back: () => go(index - 1), next: () => go(index + 1) }}>
      <div className="pxd-steps" {...useA11y(node)}>
        <p className="pxd-steps-progress">{`Step ${index + 1} of ${total}`}</p>
        <ol className="pxd-steps-list">
          {node.steps.map((st: any, i: number) => (
            <li key={st.key} aria-current={i === index ? "step" : undefined} className={i < index ? "pxd-step-done" : i === index ? "pxd-step-current" : undefined}>
              {b.text(st.title)}
            </li>
          ))}
        </ol>
        <form
          className="pxd-steps-content"
          onSubmit={(e) => {
            e.preventDefault();
            if (last) s.dispatch(node.finish.action, b.scope, node.id);
            else go(index + 1);
          }}
        >
          <Heading className="pxd-steps-title">{b.text(step.title)}</Heading>
          <Render key={step.key} id={step.content} />
          <div className="pxd-action-bar">
            <button type="submit" className="pxd-button pxd-button-primary">
              {last ? b.text(node.finish.label) : "Continue"}
            </button>
            {index > 0 && (
              <button type="button" className="pxd-button pxd-button-secondary" onClick={() => go(index - 1)}>
                Back
              </button>
            )}
          </div>
        </form>
      </div>
    </StepsContext.Provider>
  );
}

/**
 * Confirmation. When it is the surface root, the surface *is* the dialog: it renders inline as an
 * alertdialog scoped to the surface, so it never takes over the host page. When it opens on top of
 * other surface content, it is a modal dialog (Radix AlertDialog), portalled inside the surface.
 */
export function Confirm({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const isRoot = s.doc.root === node.id;
  const [open, setOpen] = useState(true);
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const descId = useId();
  const mustType = node.typeToConfirm !== undefined ? b.text(node.typeToConfirm) : undefined;
  const ready = !mustType || typed.trim() === mustType;
  const destructive = node.severity === "destructive";
  const a11y = useA11y(node);
  // A root confirmation takes focus on its safest option (Cancel), like a dialog would.
  const safest = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isRoot) safest.current?.focus({ preventScroll: true });
  }, [isRoot]);
  const cancel = () => {
    if (!isRoot) setOpen(false);
    s.dispatch(node.cancel?.action ?? { event: { name: "ui.dismiss" } }, b.scope, node.id);
  };
  const confirm = () => ready && s.dispatch(node.confirm.action, b.scope, node.id);

  const subject = node.subject && (
    <div className="pxd-dialog-subject">
      <Avatar value={node.subject.avatar !== undefined ? b.value(node.subject.avatar) : undefined} name={b.text(node.subject.title)} size={56} />
      <div>
        <div className="pxd-dialog-subject-title">{b.text(node.subject.title)}</div>
        {node.subject.subtitle !== undefined && <div className="pxd-dialog-subject-sub">{b.text(node.subject.subtitle)}</div>}
      </div>
    </div>
  );
  const amount = node.amount && <div className="pxd-dialog-amount">{b.text(node.amount.value, node.amount.format)}</div>;
  const consequences = Array.isArray(node.consequences) && (
    <ul className="pxd-consequences">
      {node.consequences.map((c: any, i: number) => (
        <li key={i}>
          <span className="pxd-consequence-icon">
            <Icon name={c.icon ?? "info"} />
          </span>
          <span>
            <span className="pxd-consequence-title">{b.text(c.title)}</span>
            {c.detail !== undefined && <span className="pxd-consequence-detail">{b.text(c.detail)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
  const description = (
    <div className="pxd-dialog-description" id={descId}>
      {node.message !== undefined && <p>{b.text(node.message)}</p>}
    </div>
  );
  // The consequence sits directly above the confirm button (design review, 2026-09-20).
  const consequence = node.consequence !== undefined && (
    <p className="pxd-dialog-consequence" id={`${descId}-consequence`}>
      <Icon name="info" size={18} />
      <span>{b.text(node.consequence)}</span>
    </p>
  );
  const body = (confirmButton: React.ReactNode, cancelButton: React.ReactNode) => (
    <>
      {consequences}
      {node.summary && <Render id={node.summary} />}
      {mustType && (
        <div className="pxd-field">
          <label className="pxd-field-label" htmlFor={`${node.id}-type`}>
            Type <strong>{mustType}</strong> to confirm
          </label>
          <input id={`${node.id}-type`} className="pxd-input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      )}
      {consequence}
      <div className="pxd-action-bar">
        {confirmButton}
        {cancelButton}
      </div>
    </>
  );
  const confirmButton = (
    <button type="button" className={`pxd-button pxd-button-primary${destructive ? " pxd-button-danger" : ""}`} disabled={!ready} onClick={confirm}>
      {b.text(node.confirm.label)}
    </button>
  );
  const cancelLabel = node.cancel ? b.text(node.cancel.label) : "Cancel";

  if (isRoot) {
    return (
      <div
        role="alertdialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={node.consequence !== undefined ? `${descId} ${descId}-consequence` : descId}
        className={`pxd-dialog pxd-dialog-inline${destructive ? " pxd-dialog-destructive" : ""}`}
        onKeyDown={(e) => e.key === "Escape" && cancel()}
        {...a11y}
      >
        <h1 className="pxd-dialog-title" id={titleId}>
          {b.text(node.title)}
        </h1>
        {amount}
        {subject}
        {description}
        {body(
          confirmButton,
          <button type="button" ref={safest} className="pxd-button pxd-button-secondary" onClick={cancel}>
            {cancelLabel}
          </button>,
        )}
      </div>
    );
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : cancel())}>
      <AlertDialog.Portal container={s.portal}>
        <AlertDialog.Overlay className="pxd-overlay" />
        <AlertDialog.Content className={`pxd-dialog${destructive ? " pxd-dialog-destructive" : ""}`} aria-describedby={node.consequence !== undefined ? `${descId} ${descId}-consequence` : descId} {...a11y}>
          <AlertDialog.Title className="pxd-dialog-title">{b.text(node.title)}</AlertDialog.Title>
          {amount}
          {subject}
          <AlertDialog.Description asChild>{description}</AlertDialog.Description>
          {body(
            <AlertDialog.Action asChild onClick={(e) => (e.preventDefault(), confirm())}>
              {confirmButton}
            </AlertDialog.Action>,
            <AlertDialog.Cancel asChild>
              <button type="button" className="pxd-button pxd-button-secondary" autoFocus>
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>,
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Comparison({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const pointer = absolute(node.items.path, b.scope);
  const items = (get(s.data, pointer) as unknown[]) ?? [];
  const scopes = items.map((_, i) => ({ pointer: childPointer(pointer, i) }));
  const at = (path: string, i: number) => get(s.data, absolute(path, scopes[i]));
  const recommended = node.recommended !== undefined ? b.text(node.recommended) : undefined;
  // Best item per attribute, when the attribute says which direction is better.
  const best = new Map<string, number>();
  for (const a of node.attributes) {
    if (!a.better || a.better === "none") continue;
    const vals = items.map((_, i) => Number(at(a.path, i)));
    const target = a.better === "higher" ? Math.max(...vals) : Math.min(...vals);
    if (vals.filter((v) => v === target).length === 1) best.set(a.key, vals.indexOf(target));
  }
  return (
    <div className="pxd-comparison" {...useA11y(node)}>
      {node.summary !== undefined && <p className="pxd-comparison-summary">{b.text(node.summary)}</p>}
      <ul className="pxd-comparison-items">
        {items.map((_, i) => {
          const title = String(at(node.itemTitle, i) ?? "");
          const isRecommended = recommended === title;
          return (
            <li key={i} className={`pxd-comparison-item${isRecommended ? " pxd-recommended" : ""}`}>
              <Heading className="pxd-comparison-title">
                {title}
                {isRecommended && <span className="pxd-badge pxd-tone-info">Recommended</span>}
              </Heading>
              <dl>
                {node.attributes.map((a: any) => (
                  <div className="pxd-detail-row" key={a.key}>
                    <dt>{b.text(a.label)}</dt>
                    <dd>
                      {formatValue(at(a.path, i), resolveFormat(a.format, s.data, b.scope), s.locale)}
                      {best.get(a.key) === i && <span className="pxd-best"> Best</span>}
                    </dd>
                  </div>
                ))}
              </dl>
              {node.choose && (
                <button type="button" className={`pxd-button ${isRecommended ? "pxd-button-primary" : "pxd-button-secondary"}`} onClick={() => s.dispatch(node.choose.action, scopes[i], node.id)}>
                  {b.text(node.choose.label)} <span className="pxd-sr-only">{title}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
