import { MORE_ACTIONS, TRIGGER_FALLBACK, fitActions, menuOrder, minShown, type Node } from "@polyxd/core";
import { h, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Menu, closedMenu, menuTrigger, type MenuItemSpec, type MenuState } from "../primitives.ts";
import { Icon } from "./avatar.ts";

/**
 * Children are in order of importance; CSS places the primary where each layout expects it.
 * In the wide (row) layout, actions that would wrap onto a second line fold into a "More actions"
 * menu, least important first (core's rule). Widths are measured from buttons as they are drawn
 * and remembered, so a folded action is never rendered twice and folding never changes what is
 * measured.
 */
export function ActionBar(node: Node, ctx: Ctx): VNode {
  const r = ctx.r;
  const ids: string[] = node.children ?? [];
  const [shown, setShown] = ctx.state<number>(node, "shown", ids.length);
  const [widths] = ctx.state<Map<string, number>>(node, "widths", () => new Map());
  const [measured] = ctx.state<{ trigger: number; width: number }>(node, "measured", () => ({ trigger: TRIGGER_FALLBACK, width: -1 }));
  const [menu, setMenu] = ctx.state<MenuState>(node, "menu", closedMenu);
  const floor = minShown(ids, r.byId);
  const id = ctx.id(node, "more");

  const fit = (el: HTMLElement) => {
    if (ids.length <= 2 || getComputedStyle(el).flexDirection === "column") return setShown(ids.length);
    for (const child of el.querySelectorAll<HTMLElement>(":scope > [data-pxd-id]")) if (child.offsetWidth) widths.set(child.dataset.pxdId!, child.offsetWidth);
    const trigger = el.querySelector<HTMLElement>(":scope > .pxd-action-bar-more");
    if (trigger?.offsetWidth) measured.trigger = trigger.offsetWidth;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    setShown(fitActions(ids, (i) => widths.get(i) ?? 0, gap, el.clientWidth, measured.trigger, floor));
  };
  const ref = (el: Element | null) => {
    if (!el) return;
    r.observeWidth(el, `${node.id}:bar`, (w) => {
      if (w === measured.width) return; // height changes as rows wrap; only width matters here
      measured.width = w;
      fit(el as HTMLElement);
    });
  };
  ctx.after(() => {
    const el = r.root?.querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(node.id)}"].pxd-action-bar`);
    if (el) fit(el);
  });

  const visible = ids.slice(0, Math.min(shown, ids.length));
  const folded = ids.slice(visible.length);
  if (folded.length) Menu(ctx, id, menu, setMenu, actionItems(ctx, folded), { class: "pxd-menu pxd-action-menu" });
  return h(
    "div",
    { class: "pxd-action-bar", role: "group", "aria-label": "Actions", ...ctx.a11y(node), ref },
    ...visible.map((cid) => ctx.render(cid)),
    folded.length > 0 && h("button", { type: "button", ...menuTrigger(id, menu, setMenu, "start", { class: "pxd-icon-button pxd-action-menu-trigger pxd-action-menu-overflow pxd-action-bar-more", "aria-label": MORE_ACTIONS }) }, Icon("dots", 18)),
  );
}

/** Actions as menu items, the same way ActionMenu draws them: danger last, after a divider. */
export function actionItems(ctx: Ctx, ids: string[]): (MenuItemSpec | "separator")[] {
  const b = ctx.b;
  const actions = ids.map((id) => ctx.r.byId.get(id)).filter((a): a is Node => Boolean(a) && a!.component === "Action" && (a!.visible === undefined || b.value(a!.visible) !== false));
  const { usual, danger, divider } = menuOrder(actions);
  const item = (a: Node): MenuItemSpec => ({
    key: a.id,
    label: [b.text(a.label)],
    class: `pxd-menu-item${a.tone === "danger" ? " pxd-menu-item-danger" : ""}`,
    disabled: a.disabled !== undefined ? Boolean(b.value(a.disabled)) : undefined,
    onSelect: () => ctx.r.dispatch(a.action, b.scope, a.id),
    props: { "data-pxd-id": a.id, "data-pxd-component": a.component },
  });
  return [...usual.map(item), ...(divider ? ["separator" as const] : []), ...danger.map(item)];
}
