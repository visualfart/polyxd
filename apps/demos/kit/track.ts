/**
 * polyxd.com's own analytics, when the site was built with them (apps/site/scripts/analytics.ts
 * defines `pxdTrack` on the page). Otherwise, and whenever the visitor asks not to be tracked,
 * there is no `pxdTrack` and this does nothing. Only fixed names and counts go in: never an ask.
 */
export function track(event: string, properties: Record<string, string | number | boolean>): void {
  try {
    (globalThis as { pxdTrack?: (event: string, properties: Record<string, string | number | boolean>) => void }).pxdTrack?.(event, properties);
  } catch {
    // Analytics never break a demo.
  }
}
