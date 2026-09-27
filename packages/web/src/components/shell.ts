import { ROOT_SCOPE, appBarTitle, frameWidth, placementFor, resolve, resolveDeep, type FrameWidth, type Node } from "@polyxd/core";
import { adopt, h, type VChild, type VNode } from "../dom.ts";
import type { Ctx, FrameContextValue, HostComponent } from "../renderer.ts";
import { Icon } from "./avatar.ts";
import { Skeleton } from "../skeleton.ts";

/**
 * The product's frame: its regions in reading order (skip link, banner, header, navigation,
 * main, aside, footer), laid out for the width the frame has. The header's AppBar and the
 * navigation read what was decided from the frame context; the host's screen arrives through
 * the Outlet from the surface's `outlet` prop (<polyxd-frame>).
 */
export function Frame(node: Node, ctx: Ctx): VNode {
  const r = ctx.r;
  const mainId = ctx.id(node, "main");
  // The first paint assumes a wide layout; the frame measures itself before the next.
  const [width, setWidth] = ctx.state<FrameWidth>(node, "width", "wide");
  const [drawerOpen, setDrawerOpen] = ctx.state<boolean>(node, "drawer", false);
  const nav = node.navigation ? r.byId.get(node.navigation) : undefined;
  const navigation = placementFor(nav?.placement, width, nav?.items?.length ?? 0);
  const text = (v: unknown) => String(resolve(v, r.data, ROOT_SCOPE) ?? "");
  // A drawer that was open cannot linger once the width grows past it.
  if (navigation !== "drawer" && drawerOpen) setDrawerOpen(false);

  const frame: FrameContextValue = {
    navigation,
    compact: width === "compact",
    mainId,
    navigationId: nav?.id,
    navigationLabel: nav ? (nav.label !== undefined ? text(nav.label) : "Main") : undefined,
    current: r.props.current,
    drawerOpen,
    setDrawerOpen,
  };
  const inner = ctx.with({ frame });
  const header = node.header ? r.byId.get(node.header) : undefined;
  const aside = node.aside ? r.byId.get(node.aside) : undefined;
  return h(
    "div",
    {
      class: `pxd-frame pxd-frame-width-${node.width ?? "contained"}`,
      "data-pxd-layout": width,
      "data-pxd-nav": navigation,
      "data-pxd-appbar": header?.component === "AppBar" && header.sticky !== false ? (header.variant ?? "standard") : undefined,
      ...ctx.a11y(node),
      ref: (el: Element | null) => el && r.observeWidth(el, `${node.id}:frame`, (w) => setWidth(frameWidth(w))),
    },
    node.skipTarget !== false &&
      h(
        "a",
        {
          class: "pxd-skip-link",
          href: `#${mainId}`,
          onClick: (e: Event) => {
            e.preventDefault();
            document.getElementById(mainId)?.focus();
          },
        },
        "Skip to main content",
      ),
    node.banner && h("div", { class: "pxd-frame-banner" }, inner.render(node.banner)),
    node.header && inner.render(node.header),
    h(
      "div",
      { class: "pxd-frame-body" },
      nav && h("div", { class: "pxd-frame-nav" }, inner.render(nav.id)),
      h("div", { class: "pxd-frame-main" }, inner.render(node.main)),
      aside && h("aside", { class: "pxd-frame-aside", "aria-label": aside.title !== undefined ? text(aside.title) : "Aside" }, inner.render(aside.id)),
    ),
    node.footer && inner.render(node.footer),
  );
}

/** The logo when the host can resolve the reference, otherwise the initials as a mark. */
function Brand(ctx: Ctx, value: unknown, name: string): VNode {
  const ref = typeof value === "string" ? value : "";
  const url = ref.length > 3 ? ctx.r.props.resolveMedia?.(ref) : undefined;
  if (url) return h("img", { class: "pxd-appbar-logo", src: url, alt: "" });
  const initials = (ref && ref.length <= 3 ? ref : name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2)).toUpperCase();
  return h("span", { class: "pxd-appbar-mark", "aria-hidden": "true" }, initials);
}

/**
 * The bar at the top of the product. The title is the product's name, or the current screen's
 * on compact layouts when the Frame knows it. When the Frame put the navigation in a drawer,
 * the menu button that opens it sits at the start. Search folds to an icon on compact layouts.
 */
export function AppBar(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const frame = ctx.frame;
  const [scrolled, setScrolled] = ctx.state<boolean>(node, "scrolled", false);
  const [searchOpen, setSearchOpen] = ctx.state<boolean>(node, "search", false);
  const variant: string = node.variant ?? "standard";
  const sticky = node.sticky !== false;
  const compact = frame?.compact ?? false;
  const product = b.text(node.title);
  const title = appBarTitle(product, compact, frame?.current?.title);
  const menu = frame?.navigation === "drawer";
  const observers = new WeakMap<Element, IntersectionObserver>();
  // Elevation once content scrolls under the bar: a sentinel just above it leaves the viewport.
  const sentinelRef = (el: Element | null) => {
    if (!el || !sticky || typeof IntersectionObserver === "undefined" || observers.has(el)) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    observers.set(el, io);
  };
  const search = (row: boolean) =>
    h(
      "div",
      {
        class: `pxd-appbar-search${row ? " pxd-appbar-search-row" : ""}`,
        role: "search",
        "aria-label": "Search",
        ref: row ? (el: Element | null) => el && searchOpen && !(el as HTMLElement).dataset.focused && ((el as HTMLElement).dataset.focused = "1", el.querySelector<HTMLElement>("input, button")?.focus()) : undefined,
      },
      ctx.render(node.search),
    );
  return [
    h("div", { class: "pxd-appbar-sentinel", "aria-hidden": "true", ref: sentinelRef }),
    h(
      "header",
      { class: `pxd-appbar pxd-appbar-${variant}${sticky ? " pxd-appbar-sticky" : ""}`, "data-pxd-scrolled": scrolled || undefined, ...ctx.a11y(node) },
      h(
        "div",
        { class: "pxd-appbar-row" },
        menu
          ? h("button", { type: "button", class: "pxd-icon-button pxd-appbar-menu", "aria-label": `${frame!.navigationLabel ?? "Main"} menu`, "aria-expanded": frame!.drawerOpen, onClick: () => frame!.setDrawerOpen(true) }, Icon("menu"))
          : node.leading && h("div", { class: "pxd-appbar-leading" }, ctx.render(node.leading)),
        h("div", { class: "pxd-appbar-brand" }, node.brand !== undefined && Brand(ctx, b.value(node.brand), product), (variant !== "large" || compact) && h("span", { class: "pxd-appbar-title" }, title)),
        node.search &&
          (compact
            ? h("button", { type: "button", class: "pxd-icon-button pxd-appbar-search-toggle", "aria-label": searchOpen ? "Close search" : "Search", "aria-expanded": searchOpen, onClick: () => setSearchOpen(!searchOpen) }, Icon(searchOpen ? "close" : "search"))
            : search(false)),
        (node.actions || node.account) &&
          h("div", { class: "pxd-appbar-end" }, node.actions && h("div", { class: "pxd-appbar-actions" }, ctx.render(node.actions)), node.account && h("div", { class: "pxd-appbar-account" }, ctx.render(node.account))),
      ),
      node.search && compact && searchOpen && search(true),
      variant === "large" && !compact && h("div", { class: "pxd-appbar-headline" }, title),
    ),
  ];
}

/** The bar at the bottom of the product: link groups as columns (stacked on compact), then the legal line. */
export function Footer(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const level = Math.min(ctx.heading, 6);
  const groups: any[] = node.groups ?? [];
  return h(
    "footer",
    { class: "pxd-footer", ...ctx.a11y(node) },
    groups.length > 0 &&
      h(
        "div",
        { class: "pxd-footer-groups" },
        ...groups.map((g) => {
          const id = ctx.id(node, g.key);
          return h(
            "nav",
            { key: g.key, class: "pxd-footer-group", "aria-labelledby": id },
            h(`h${level}`, { id, class: "pxd-footer-heading" }, b.text(g.label)),
            h("ul", null, ...g.items.map((item: any) => h("li", { key: item.key }, h("button", { type: "button", class: "pxd-link pxd-footer-link", onClick: () => ctx.r.dispatch(item.action, b.scope, node.id) }, b.text(item.label))))),
          );
        }),
      ),
    h("div", { class: "pxd-footer-legal" }, h("p", { class: "pxd-footer-legal-text" }, b.text(node.legal)), node.aside && h("div", { class: "pxd-footer-aside" }, ctx.render(node.aside))),
  );
}

/**
 * Where the current screen renders: the host's element, or a skeleton while a screen is on its
 * way. When the screen changes, focus moves to its h1. The frame's decisions still reach the
 * screen, but its navigation slot does not: a screen's own Navigation is not the frame's.
 */
export function Outlet(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const frame = ctx.frame;
  const loading = Boolean(r.props.loading);
  const at = `${r.props.current?.key ?? ""}\u0000${r.props.current?.title ?? ""}`;
  // The screen the outlet last showed: the first keeps the browser's focus where it was; only a change moves it.
  const [shown, setShown] = ctx.state<string>(node, "shown", at);
  if (shown !== at) {
    setShown(at);
    if (!loading)
      ctx.after(() => {
        const main = document.getElementById(frame?.mainId ?? "") as HTMLElement | null;
        if (!main) return;
        const h1 = main.querySelector<HTMLElement>("h1");
        if (h1 && !h1.hasAttribute("tabindex")) h1.tabIndex = -1;
        (h1 ?? main).focus();
      });
  }
  const outlet = r.props.outlet;
  return h(
    "main",
    { id: frame?.mainId, class: "pxd-outlet", tabindex: "-1", "aria-label": node.label !== undefined ? b.text(node.label) : undefined, ...ctx.a11y(node) },
    loading ? (node.loading ? ctx.render(node.loading) : Skeleton({ title: r.props.current?.title, className: "pxd-outlet-skeleton" })) : outlet ? adopt(outlet, "outlet") : null,
  );
}

const noted = new Set<string>();

/**
 * A slot for a component the host implements: looked up by name in the surface's `components`
 * and rendered with its props resolved. Without one, the fallback stands in, and the console
 * hears about the missing name once. The raw props are never drawn.
 */
export function Custom(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const Host = ctx.r.components[node.name] as HostComponent | undefined;
  if (!Host) {
    if (!noted.has(node.name)) {
      noted.add(node.name);
      console.warn(`[polyxd] No host component named "${node.name}"; rendering its fallback. Pass one in the surface's components.`);
    }
    return node.fallback ? ctx.render(node.fallback) : null;
  }
  const props = (resolveDeep(node.props ?? {}, ctx.r.data, b.scope) ?? {}) as Record<string, unknown>;
  const out = Host({ ...props, node });
  const el = out instanceof Element ? adopt(out, node.id) : out;
  if (node.label === undefined) return el;
  return h("div", { class: "pxd-custom", role: "group", "aria-label": b.text(node.label), ...ctx.a11y(node) }, el);
}
