/** The Frame's layout rule, per width and placement, and the navigation's own breakpoint. */
import type { NavigationPlacement } from "./document.ts";

/** The Frame's breakpoints, on its own width: wide has room for a side column, medium for a rail. */
export const WIDE_PX = 1024;
export const MEDIUM_PX = 640;
/** A bottom bar holds at most this many items; more go behind a menu button. */
export const BAR_MAX = 5;
/** Below this width a surface's own navigation moves behind a menu button. */
export const NAV_COMPACT_PX = 900;

export type FrameWidth = "wide" | "medium" | "compact";

export const frameWidth = (px: number): FrameWidth => (px >= WIDE_PX ? "wide" : px >= MEDIUM_PX ? "medium" : "compact");

/**
 * Where the main navigation goes. 'auto' follows the width. 'side' and 'rail' hold on wide and
 * medium layouts and still collapse on compact, where neither fits beside a screen; 'bar' and
 * 'drawer' hold everywhere, except that a bar with too many items becomes a drawer.
 */
export function placementFor(placement: string | undefined, width: FrameWidth, items: number): NavigationPlacement {
  const fits = items <= BAR_MAX;
  if (placement === "bar") return fits ? "bar" : "drawer";
  if (placement === "drawer") return "drawer";
  if (width === "compact") return fits ? "bar" : "drawer";
  if (placement === "side" || placement === "rail") return placement;
  return width === "wide" ? "side" : "rail";
}

/** The AppBar's title: the current screen's on compact layouts when the frame knows it, else the product's. */
export const appBarTitle = (product: string, compact: boolean, current?: string): string => (compact && current ? current : product);

/** The document title follows the current screen: "Payments · Halden". */
export const documentTitle = (product: string, current?: string): string => (current ? `${current} · ${product}` : product);
