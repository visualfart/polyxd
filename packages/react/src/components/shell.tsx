import { createElement, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent } from "react";
import { FrameContext, FrameHostContext, HeadingContext, useBindings, useSurface, type FrameContextValue, type NavigationPlacement, type Node } from "../context.tsx";
import { ROOT_SCOPE, isBinding, resolve, type Scope } from "../data.ts";
import { Render, useA11y } from "../surface.tsx";
import { PolyxdSkeleton } from "../skeleton.tsx";
import { Icon } from "./avatar.tsx";

/** The Frame's breakpoints, on its own width: wide has room for a side column, medium for a rail. */
const WIDE_PX = 1024;
const MEDIUM_PX = 640;
/** A bottom bar holds at most this many items; more go behind a menu button. */
const BAR_MAX = 5;

type Width = "wide" | "medium" | "compact";

/**
 * Where the main navigation goes. 'auto' follows the width. 'side' and 'rail' hold on wide and
 * medium layouts and still collapse on compact, where neither fits beside a screen; 'bar' and
 * 'drawer' hold everywhere, except that a bar with too many items becomes a drawer.
 */
function placementFor(placement: string | undefined, width: Width, items: number): NavigationPlacement {
  const fits = items <= BAR_MAX;
  if (placement === "bar") return fits ? "bar" : "drawer";
  if (placement === "drawer") return "drawer";
  if (width === "compact") return fits ? "bar" : "drawer";
  if (placement === "side" || placement === "rail") return placement;
  return width === "wide" ? "side" : "rail";
}

/**
 * The product's frame: its regions in reading order (skip link, banner, header, navigation,
 * main, aside, footer), laid out for the width the frame has. The header's AppBar and the
 * navigation read what was decided from FrameContext; the host's screen arrives through the
 * Outlet from FrameHostContext (PolyxdFrame).
 */
export function Frame({ node }: { node: Node }) {
  const s = useSurface();
  const host = useContext(FrameHostContext);
  const ref = useRef<HTMLDivElement>(null);
  const mainId = useId();
  // The server and the first paint assume a wide layout; the frame measures itself before paint.
  const [width, setWidth] = useState<Width>("wide");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const a11y = useA11y(node);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      setWidth(w >= WIDE_PX ? "wide" : w >= MEDIUM_PX ? "medium" : "compact");
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nav = node.navigation ? s.byId.get(node.navigation) : undefined;
  const navigation = placementFor(nav?.placement, width, nav?.items?.length ?? 0);
  const text = (v: unknown) => String(resolve(v, s.data, ROOT_SCOPE) ?? "");
  // A drawer that was open cannot linger once the width grows past it.
  useEffect(() => {
    if (navigation !== "drawer") setDrawerOpen(false);
  }, [navigation]);

  const value: FrameContextValue = {
    navigation,
    compact: width === "compact",
    mainId,
    navigationId: nav?.id,
    navigationLabel: nav ? (nav.label !== undefined ? text(nav.label) : "Main") : undefined,
    current: host?.current,
    drawerOpen,
    setDrawerOpen,
  };
  const header = node.header ? s.byId.get(node.header) : undefined;
  const aside = node.aside ? s.byId.get(node.aside) : undefined;
  const skip = (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(mainId)?.focus();
  };

  return (
    <FrameContext.Provider value={value}>
      <div
        ref={ref}
        className={`pxd-frame pxd-frame-width-${node.width ?? "contained"}`}
        data-pxd-layout={width}
        data-pxd-nav={navigation}
        data-pxd-appbar={header?.component === "AppBar" && header.sticky !== false ? (header.variant ?? "standard") : undefined}
        {...a11y}
      >
        {node.skipTarget !== false && (
          <a className="pxd-skip-link" href={`#${mainId}`} onClick={skip}>
            Skip to main content
          </a>
        )}
        {node.banner && (
          <div className="pxd-frame-banner">
            <Render id={node.banner} />
          </div>
        )}
        {node.header && <Render id={node.header} />}
        <div className="pxd-frame-body">
          {nav && (
            <div className="pxd-frame-nav">
              <Render id={nav.id} />
            </div>
          )}
          <div className="pxd-frame-main">
            <Render id={node.main} />
          </div>
          {aside && (
            <aside className="pxd-frame-aside" aria-label={aside.title !== undefined ? text(aside.title) : "Aside"}>
              <Render id={aside.id} />
            </aside>
          )}
        </div>
        {node.footer && <Render id={node.footer} />}
      </div>
    </FrameContext.Provider>
  );
}

/** The logo when the host can resolve the reference, otherwise the initials as a mark. */
function Brand({ value, name }: { value: unknown; name: string }) {
  const s = useSurface();
  const ref = typeof value === "string" ? value : "";
  const url = ref.length > 3 ? s.resolveMedia?.(ref) : undefined;
  if (url) return <img className="pxd-appbar-logo" src={url} alt="" />;
  const initials = (ref && ref.length <= 3 ? ref : name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2)).toUpperCase();
  return (
    <span className="pxd-appbar-mark" aria-hidden="true">
      {initials}
    </span>
  );
}

/**
 * The bar at the top of the product. The title is the product's name, or the current screen's
 * on compact layouts when the Frame knows it; it is never a heading (the screen's h1 stays in
 * main). When the Frame put the navigation in a drawer, the menu button that opens it sits at
 * the start. Search grows in the middle and folds to an icon on compact layouts.
 */
export function AppBar({ node }: { node: Node }) {
  const b = useBindings();
  const frame = useContext(FrameContext);
  const a11y = useA11y(node);
  const sentinel = useRef<HTMLDivElement>(null);
  const searchRow = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const variant: string = node.variant ?? "standard";
  const sticky = node.sticky !== false;
  const compact = frame?.compact ?? false;
  const product = b.text(node.title);
  const title = compact && frame?.current?.title ? frame.current.title : product;
  const menu = frame?.navigation === "drawer";

  // Elevation once content scrolls under the bar: a sentinel just above it leaves the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!sticky || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [sticky]);
  useEffect(() => {
    if (searchOpen) searchRow.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [searchOpen]);

  const search = (
    <div ref={searchRow} className={`pxd-appbar-search${compact ? " pxd-appbar-search-row" : ""}`} role="search" aria-label="Search">
      <Render id={node.search} />
    </div>
  );
  return (
    <>
      <div ref={sentinel} className="pxd-appbar-sentinel" aria-hidden="true" />
      <header className={`pxd-appbar pxd-appbar-${variant}${sticky ? " pxd-appbar-sticky" : ""}`} data-pxd-scrolled={scrolled || undefined} {...a11y}>
        <div className="pxd-appbar-row">
          {menu ? (
            <button type="button" className="pxd-icon-button pxd-appbar-menu" aria-label={`${frame!.navigationLabel ?? "Main"} menu`} aria-expanded={frame!.drawerOpen} onClick={() => frame!.setDrawerOpen(true)}>
              <Icon name="menu" />
            </button>
          ) : (
            node.leading && (
              <div className="pxd-appbar-leading">
                <Render id={node.leading} />
              </div>
            )
          )}
          <div className="pxd-appbar-brand">
            {node.brand !== undefined && <Brand value={b.value(node.brand)} name={product} />}
            {(variant !== "large" || compact) && <span className="pxd-appbar-title">{title}</span>}
          </div>
          {node.search &&
            (compact ? (
              <button type="button" className="pxd-icon-button pxd-appbar-search-toggle" aria-label={searchOpen ? "Close search" : "Search"} aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
                <Icon name={searchOpen ? "close" : "search"} />
              </button>
            ) : (
              search
            ))}
          {(node.actions || node.account) && (
            <div className="pxd-appbar-end">
              {node.actions && (
                <div className="pxd-appbar-actions">
                  <Render id={node.actions} />
                </div>
              )}
              {node.account && (
                <div className="pxd-appbar-account">
                  <Render id={node.account} />
                </div>
              )}
            </div>
          )}
        </div>
        {node.search && compact && searchOpen && search}
        {variant === "large" && !compact && <div className="pxd-appbar-headline">{title}</div>}
      </header>
    </>
  );
}

/** The bar at the bottom of the product: link groups as columns (stacked on compact), then the legal line. */
export function Footer({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const level = Math.min(useContext(HeadingContext), 6);
  const base = useId();
  const groups: any[] = node.groups ?? [];
  return (
    <footer className="pxd-footer" {...useA11y(node)}>
      {groups.length > 0 && (
        <div className="pxd-footer-groups">
          {groups.map((g) => {
            const id = `${base}-${g.key}`;
            return (
              <nav key={g.key} className="pxd-footer-group" aria-labelledby={id}>
                {createElement(`h${level}`, { id, className: "pxd-footer-heading" }, b.text(g.label))}
                <ul>
                  {g.items.map((item: any) => (
                    <li key={item.key}>
                      <button type="button" className="pxd-link pxd-footer-link" onClick={() => s.dispatch(item.action, b.scope, node.id)}>
                        {b.text(item.label)}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>
      )}
      <div className="pxd-footer-legal">
        <p className="pxd-footer-legal-text">{b.text(node.legal)}</p>
        {node.aside && (
          <div className="pxd-footer-aside">
            <Render id={node.aside} />
          </div>
        )}
      </div>
    </footer>
  );
}

/**
 * Where the current screen renders: the host's content from PolyxdFrame, or a skeleton while
 * a screen is on its way. When the screen changes, focus moves to its h1 so the change is
 * announced and reading starts at the top. The frame's decisions still reach the screen
 * (useFrame), but its navigation slot does not: a screen's own Navigation is not the frame's.
 */
export function Outlet({ node }: { node: Node }) {
  const b = useBindings();
  const host = useContext(FrameHostContext);
  const frame = useContext(FrameContext);
  const a11y = useA11y(node);
  const ref = useRef<HTMLElement>(null);
  const loading = Boolean(host?.loading);
  const at = `${host?.current?.key ?? ""}\u0000${host?.current?.title ?? ""}`;
  // The screen the outlet last showed: the first one keeps the browser's focus where it was (a
  // page load does not announce itself), and only a change moves it. Compared, not flagged, so
  // an effect run twice on the same screen (StrictMode) stays put.
  const shown = useRef(at);

  useEffect(() => {
    if (shown.current === at) return;
    shown.current = at;
    const main = ref.current;
    if (loading || !main) return;
    const h1 = main.querySelector<HTMLElement>("h1");
    if (h1 && !h1.hasAttribute("tabindex")) h1.tabIndex = -1;
    (h1 ?? main).focus();
  }, [at, loading]);

  const inner = frame ? { ...frame, navigationId: undefined } : null;
  return (
    <main ref={ref} id={frame?.mainId} className="pxd-outlet" tabIndex={-1} aria-label={node.label !== undefined ? b.text(node.label) : undefined} {...a11y}>
      {loading ? (
        node.loading ? (
          <Render id={node.loading} />
        ) : (
          <PolyxdSkeleton title={host?.current?.title} className="pxd-outlet-skeleton" />
        )
      ) : (
        <FrameContext.Provider value={inner}>{host?.outlet}</FrameContext.Provider>
      )}
    </main>
  );
}

/** Bundlers replace process.env.NODE_ENV; a bare browser has no process, and counts as development. */
const DEV = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return true;
  }
})();
const noted = new Set<string>();

/** A prop's value, with bindings resolved wherever they sit in it. */
function resolveProps(value: unknown, data: unknown, scope: Scope): unknown {
  if (isBinding(value)) return resolve(value, data, scope);
  if (Array.isArray(value)) return value.map((v) => resolveProps(v, data, scope));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveProps(v, data, scope)]));
  return value;
}

/**
 * A slot for a component the host implements: looked up by name in the surface's `components`
 * (the same registry that overrides renderers, under a namespaced key like "brand.logo") and
 * rendered with its props resolved. Without one, the fallback stands in, and development hears
 * about the missing name once. The raw props are never drawn.
 */
export function Custom({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const a11y = useA11y(node);
  const Host = s.components[node.name] as ComponentType<any> | undefined;
  if (!Host) {
    if (DEV && !noted.has(node.name)) {
      noted.add(node.name);
      console.warn(`[polyxd] No host component named "${node.name}"; rendering its fallback. Pass one in PolyxdSurface's components.`);
    }
    return node.fallback ? <Render id={node.fallback} /> : null;
  }
  const props = (resolveProps(node.props ?? {}, s.data, b.scope) ?? {}) as Record<string, unknown>;
  const el = <Host {...props} node={node} />;
  if (node.label === undefined) return el;
  return (
    <div className="pxd-custom" role="group" aria-label={b.text(node.label)} {...a11y}>
      {el}
    </div>
  );
}
