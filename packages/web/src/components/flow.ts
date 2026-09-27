import {
  absolute, asList, bestPerAttribute, childPointer, copyText, formatValue, get, groupAttributes, initialStep, isApplePlatform, isLastStep, parseShortcut, recommendedFirst, resolveFormat, shortcutMatches, stepsProgress, stepsReducer, tasklistProgress, tasklistReducer, taskStatus, unmodified,
  type Node, type StepsState,
} from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Dialog, isEditable } from "../primitives.ts";
import { Avatar, Icon } from "./avatar.ts";
import { Heading } from "./structure.ts";

const isApple = () => isApplePlatform((navigator as any).userAgentData?.platform ?? navigator.platform ?? "");

export function Action(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const descId = ctx.id(node, "desc");
  const [copied, setCopied] = ctx.state<boolean>(node, "copied", false);
  const disabled = node.disabled !== undefined ? Boolean(b.value(node.disabled)) : false;
  const tone = node.tone === "danger" ? " pxd-button-danger" : "";
  const description = node.description !== undefined ? b.text(node.description) : undefined;
  const shortcut = typeof node.shortcut === "string" && node.shortcut ? parseShortcut(node.shortcut, isApple()) : undefined;
  const onClick = () => {
    const name = node.action.event.name;
    if (name === "ui.back" && ctx.steps) return ctx.steps.back();
    if (name === "ui.next" && ctx.steps) return ctx.steps.next();
    if (name === "ui.copy") {
      // Copies 'copy', or the context's 'text', and says so; the host still hears the action.
      const text = copyText(node, r.data, b.scope, b.text);
      const done = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      };
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => undefined);
      else done();
    }
    r.dispatch(node.action, b.scope, node.id);
  };
  // A shell is the page: its shortcuts work wherever focus is, even nowhere yet.
  const shell = r.doc.surface.kind === "shell";
  const listen = (el: Element | null) => {
    const button = el as (HTMLElement & { pxdKey?: (e: KeyboardEvent) => void }) | null;
    if (!button) return;
    if (button.pxdKey) document.removeEventListener("keydown", button.pxdKey);
    if (!shortcut || disabled) return;
    button.pxdKey = (e: KeyboardEvent) => {
      const root = r.root;
      if (e.defaultPrevented || e.repeat || !root || !button.isConnected) return;
      if (!shell && !root.contains(document.activeElement) && !(e.target instanceof HTMLElement && root.contains(e.target))) return;
      if (!shortcutMatches(shortcut, e)) return;
      if (unmodified(shortcut) && isEditable(e.target)) return;
      e.preventDefault();
      button.click();
    };
    document.addEventListener("keydown", button.pxdKey);
    r.onDispose(() => button.pxdKey && document.removeEventListener("keydown", button.pxdKey));
  };
  return h(
    "button",
    { type: "button", class: `pxd-button pxd-button-${node.emphasis ?? "secondary"}${tone}${description ? " pxd-button-described" : ""}`, disabled, "aria-describedby": description ? descId : undefined, "aria-keyshortcuts": shortcut?.aria, onClick, ...ctx.a11y(node), ref: listen },
    h("span", { class: "pxd-button-label" }, copied ? "Copied" : b.text(node.label)),
    shortcut && h("span", { class: "pxd-kbd-hint", "aria-hidden": "true" }, ...shortcut.hint.map((k, i) => h("kbd", { key: i, class: "pxd-kbd" }, k))),
    description && h("span", { class: "pxd-button-description", id: descId }, description),
    node.action.event.name === "ui.copy" && h("span", { class: "pxd-sr-only", "aria-live": "polite" }, copied ? "Copied" : ""),
  );
}

export function Steps(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const [openTask, setOpenTask] = ctx.state<string | null>(node, "task", null);
  const bound = node.current !== undefined ? b.value<number>(node.current) : undefined;
  const [local, setLocal] = ctx.state<StepsState>(node, "step", () => initialStep(bound, node.steps.length));
  const kind = node.kind ?? "wizard";
  const finish = h("div", { class: "pxd-action-bar" }, h("button", { type: "button", class: "pxd-button pxd-button-primary", onClick: () => r.dispatch(node.finish.action, b.scope, node.id) }, b.text(node.finish.label)));
  if (kind === "guide") {
    // Numbered instructions, all visible, no state to keep.
    return h(
      "div",
      { class: "pxd-steps pxd-guide", ...ctx.a11y(node) },
      h("ol", { class: "pxd-guide-list" }, ...node.steps.map((st: any, i: number) => h("li", { key: st.key, class: "pxd-guide-step" }, h("span", { class: "pxd-guide-number", "aria-hidden": "true" }, i + 1), h("div", { class: "pxd-guide-body" }, Heading(ctx, "pxd-guide-title", b.text(st.title)), ctx.render(st.content))))),
      finish,
    );
  }
  if (kind === "tasklist") {
    // Tasks in any order, each with its status; a task opens its content in place.
    const status = (st: any) => taskStatus(st.status !== undefined ? b.text(st.status) : "todo");
    const done = node.steps.filter((st: any) => status(st).label === "Completed").length;
    return h(
      "div",
      { class: "pxd-steps pxd-tasklist", ...ctx.a11y(node) },
      h("p", { class: "pxd-steps-progress" }, tasklistProgress(done, node.steps.length)),
      h(
        "ul",
        { class: "pxd-tasklist-list" },
        ...node.steps.map((st: any) => {
          const open = openTask === st.key;
          const { label, tone } = status(st);
          const blocked = label === "Cannot start yet";
          return h(
            "li",
            { key: st.key, class: `pxd-task${open ? " pxd-task-open" : ""}` },
            h("div", { class: "pxd-task-row" }, h("button", { type: "button", class: "pxd-task-title", "aria-expanded": open, disabled: blocked, onClick: () => setOpenTask(tasklistReducer(openTask, st.key)) }, b.text(st.title)), h("span", { class: `pxd-badge pxd-tone-${tone} pxd-task-status` }, label)),
            open && h("div", { class: "pxd-task-content" }, ctx.render(st.content)),
          );
        }),
      ),
      finish,
    );
  }
  const total = node.steps.length;
  const state: StepsState = typeof bound === "number" && node.current?.path ? { index: Math.max(0, Math.min(total - 1, bound)), total } : { ...local, total };
  const go = (i: number) => {
    const next = stepsReducer(state, { type: "go", index: i });
    if (node.current?.path) b.write(node.current, next.index);
    else setLocal(next);
  };
  const index = state.index;
  const step = node.steps[index];
  const last = isLastStep(state);
  const inner = ctx.with({ steps: { back: () => go(index - 1), next: () => go(index + 1) } });
  return h(
    "div",
    { class: "pxd-steps", ...ctx.a11y(node) },
    h("p", { class: "pxd-steps-progress" }, stepsProgress(state)),
    h("ol", { class: "pxd-steps-list" }, ...node.steps.map((st: any, i: number) => h("li", { key: st.key, "aria-current": i === index ? "step" : undefined, class: i < index ? "pxd-step-done" : i === index ? "pxd-step-current" : undefined }, b.text(st.title)))),
    h(
      "form",
      {
        class: "pxd-steps-content",
        onSubmit: (e: Event) => {
          e.preventDefault();
          if (last) r.dispatch(node.finish.action, b.scope, node.id);
          else go(index + 1);
        },
      },
      Heading(inner, "pxd-steps-title", b.text(step.title)),
      inner.render(step.content),
      h("div", { class: "pxd-action-bar" }, h("button", { type: "submit", class: "pxd-button pxd-button-primary" }, last ? b.text(node.finish.label) : "Continue"), index > 0 && h("button", { type: "button", class: "pxd-button pxd-button-secondary", onClick: () => go(index - 1) }, "Back")),
    ),
  );
}

/**
 * Confirmation. When it is the surface root, the surface *is* the dialog: it renders inline as an
 * alertdialog scoped to the surface. When it opens on top of other surface content, it is a modal
 * alert dialog inside the surface's portal.
 */
export function Confirm(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const r = ctx.r;
  const isRoot = r.doc.root === node.id;
  const [open, setOpen] = ctx.state<boolean>(node, "open", true);
  const [typed, setTyped] = ctx.state<string>(node, "typed", "");
  const titleId = ctx.id(node, "title");
  const descId = ctx.id(node, "desc");
  const mustType = node.typeToConfirm !== undefined ? b.text(node.typeToConfirm) : undefined;
  const ready = !mustType || typed.trim() === mustType;
  const destructive = node.severity === "destructive";
  const a11y = ctx.a11y(node);
  const cancel = () => {
    if (!isRoot) setOpen(false);
    r.dispatch(node.cancel?.action ?? { event: { name: "ui.dismiss" } }, b.scope, node.id);
  };
  const confirm = () => ready && r.dispatch(node.confirm.action, b.scope, node.id);

  const subject = node.subject && h("div", { class: "pxd-dialog-subject" }, Avatar(ctx, { value: node.subject.avatar !== undefined ? b.value(node.subject.avatar) : undefined, name: b.text(node.subject.title), size: 56 }), h("div", null, h("div", { class: "pxd-dialog-subject-title" }, b.text(node.subject.title)), node.subject.subtitle !== undefined && h("div", { class: "pxd-dialog-subject-sub" }, b.text(node.subject.subtitle))));
  const amount = node.amount && h("div", { class: "pxd-dialog-amount" }, b.text(node.amount.value, node.amount.format));
  const consequences = Array.isArray(node.consequences) && h("ul", { class: "pxd-consequences" }, ...node.consequences.map((c: any, i: number) => h("li", { key: i }, h("span", { class: "pxd-consequence-icon" }, Icon(c.icon ?? "info")), h("span", null, h("span", { class: "pxd-consequence-title" }, b.text(c.title)), c.detail !== undefined && h("span", { class: "pxd-consequence-detail" }, b.text(c.detail))))));
  const description = h("div", { class: "pxd-dialog-description", id: descId }, node.message !== undefined && h("p", null, b.text(node.message)));
  // The consequence sits directly above the confirm button (design review, 2026-09-20).
  const consequence = node.consequence !== undefined && h("p", { class: "pxd-dialog-consequence", id: `${descId}-consequence` }, Icon("info", 18), h("span", null, b.text(node.consequence)));
  const body = (confirmButton: VChild, cancelButton: VChild): VChild[] => [
    consequences,
    node.summary && ctx.render(node.summary),
    mustType && h("div", { class: "pxd-field" }, h("label", { class: "pxd-field-label", for: `${node.id}-type` }, "Type ", h("strong", null, mustType), " to confirm"), h("input", { id: `${node.id}-type`, class: "pxd-input", autocomplete: "off", value: typed, onInput: (e: Event) => setTyped((e.target as HTMLInputElement).value) })),
    consequence,
    h("div", { class: "pxd-action-bar" }, confirmButton, cancelButton),
  ];
  const confirmButton = h("button", { type: "button", class: `pxd-button pxd-button-primary${destructive ? " pxd-button-danger" : ""}`, disabled: !ready, onClick: confirm }, b.text(node.confirm.label));
  const cancelLabel = node.cancel ? b.text(node.cancel.label) : "Cancel";
  const describedBy = node.consequence !== undefined ? `${descId} ${descId}-consequence` : descId;

  if (isRoot) {
    // A root confirmation takes focus on its safest option (Cancel), like a dialog would.
    const [focused, setFocused] = ctx.state<boolean>(node, "focused", false);
    if (!focused) {
      setFocused(true);
      ctx.after(() => r.root?.querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(node.id)}"] > .pxd-action-bar > .pxd-button-secondary`)?.focus({ preventScroll: true }));
    }
    return h(
      "div",
      { role: "alertdialog", "aria-modal": "false", "aria-labelledby": titleId, "aria-describedby": describedBy, class: `pxd-dialog pxd-dialog-inline${destructive ? " pxd-dialog-destructive" : ""}`, onKeydown: (e: KeyboardEvent) => e.key === "Escape" && cancel(), ...a11y },
      h("h1", { class: "pxd-dialog-title", id: titleId }, b.text(node.title)),
      amount,
      subject,
      description,
      ...body(confirmButton, h("button", { type: "button", class: "pxd-button pxd-button-secondary", onClick: cancel }, cancelLabel)),
    );
  }

  if (!open) return null;
  ctx.portal(
    Dialog(
      { ctx, id: ctx.id(node, "dialog"), role: "alertdialog", class: `pxd-dialog${destructive ? " pxd-dialog-destructive" : ""}`, onClose: cancel, props: { "aria-labelledby": titleId, "aria-describedby": describedBy, ...a11y } },
      h("h2", { id: titleId, class: "pxd-dialog-title" }, b.text(node.title)),
      amount,
      subject,
      description,
      ...body(confirmButton, h("button", { type: "button", class: "pxd-button pxd-button-secondary", autofocus: true, onClick: cancel }, cancelLabel)),
    ),
  );
  return null;
}

export function Comparison(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const pointer = absolute(node.items.path, b.scope);
  const items = asList(get(r.data, pointer));
  const scopes = items.map((_, i) => ({ pointer: childPointer(pointer, i) }));
  const at = (path: string, i: number) => get(r.data, absolute(path, scopes[i]));
  const recommended = node.recommended !== undefined ? b.text(node.recommended) : undefined;
  const reason = node.recommendedReason !== undefined ? b.text(node.recommendedReason) : undefined;
  const best = bestPerAttribute(node.attributes, items.length, at);
  const groups = groupAttributes<any>(node.attributes, b.text);
  const order = recommendedFirst(items.map((_, i) => String(at(node.itemTitle, i) ?? "")), recommended);
  const value = (a: any, i: number): VChild => {
    const v = at(a.path, i);
    if (typeof v === "boolean") return v ? h("span", { class: "pxd-yes" }, Icon("check", 18), h("span", { class: "pxd-sr-only" }, "Included")) : h("span", { class: "pxd-no" }, Icon("dash", 18), h("span", { class: "pxd-sr-only" }, "Not included"));
    return formatValue(v, resolveFormat(a.format, r.data, b.scope), r.locale);
  };
  return h(
    "div",
    { class: "pxd-comparison", ...ctx.a11y(node) },
    node.summary !== undefined && h("p", { class: "pxd-comparison-summary" }, b.text(node.summary)),
    h(
      "ul",
      { class: "pxd-comparison-items" },
      ...order.map((i) => {
        const title = String(at(node.itemTitle, i) ?? "");
        const isRecommended = recommended === title;
        return h(
          "li",
          { key: i, class: `pxd-comparison-item${isRecommended ? " pxd-recommended" : ""}` },
          isRecommended && h("p", { class: "pxd-recommendation" }, h("span", { class: "pxd-badge pxd-tone-info" }, "Recommended"), reason && h("span", { class: "pxd-recommendation-reason" }, reason)),
          Heading(ctx, "pxd-comparison-title", title),
          ...groups.map((g, gi) => h("div", { class: "pxd-comparison-group", key: gi }, g.label && h("p", { class: "pxd-comparison-group-label" }, g.label), h("dl", null, ...g.attributes.map((a: any) => h("div", { class: "pxd-detail-row", key: a.key }, h("dt", null, b.text(a.label)), h("dd", null, value(a, i), best.get(a.key) === i && h("span", { class: "pxd-best" }, " Best"))))))),
          node.choose && h("button", { type: "button", class: `pxd-button ${isRecommended ? "pxd-button-primary" : "pxd-button-secondary"}`, onClick: () => r.dispatch(node.choose.action, scopes[i], node.id) }, `${b.text(node.choose.label)} `, h("span", { class: "pxd-sr-only" }, title)),
        );
      }),
    ),
  );
}
