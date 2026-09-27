import { useEffect, useMemo, type ReactNode } from "react";
import { FrameHostContext, type FrameHost } from "./context.tsx";
import { PolyxdSurface, type PolyxdSurfaceProps } from "./surface.tsx";

export interface PolyxdFrameProps extends Omit<PolyxdSurfaceProps, "onDismiss" | "derive"> {
  /** The current screen: a PolyxdSurface, a React screen, anything. It renders in the shell's Outlet. */
  children?: ReactNode;
  /** Which navigation item is current, and the screen's title (shown in the AppBar on compact layouts; the document title follows it). */
  current?: { key?: string; title?: string };
  /** A screen is on its way: the Outlet shows its skeleton instead of `children`. */
  loading?: boolean;
}

/**
 * Renders a shell document (surface.kind "shell": a Frame with an Outlet) around the host's
 * current screen. Navigation and AppBar actions dispatch through `onAction` like any action;
 * the host routes and re-renders with the new `children` and `current`.
 */
export function PolyxdFrame({ children, current, loading, ...surface }: PolyxdFrameProps) {
  const host = useMemo<FrameHost>(() => ({ outlet: children, current, loading }), [children, current?.key, current?.title, loading]);
  // The document title follows the current screen, as the Frame's accessibility requires.
  const product = surface.document.surface.title;
  useEffect(() => {
    if (typeof document === "undefined" || !current || !product) return;
    document.title = current.title ? `${current.title} · ${product}` : product;
  }, [current?.title, product, Boolean(current)]);
  return (
    <FrameHostContext.Provider value={host}>
      <PolyxdSurface {...surface} />
    </FrameHostContext.Provider>
  );
}
