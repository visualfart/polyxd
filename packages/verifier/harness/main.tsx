/**
 * Verifier harness: renders one UI document with one theme, and records what the UI sends to the host.
 * The verifier injects window.__PXD__ = { document, theme, mode } before the page loads.
 */
import { createRoot } from "react-dom/client";
import { PolyxdFrame, PolyxdSurface, type ActionEvent, type UIDocument } from "@polyxd/react";
import "@polyxd/react/styles.css";

import.meta.glob("../../react/themes/*.css", { eager: true });

declare global {
  interface Window {
    __PXD__: { document: UIDocument; theme: string; mode: "light" | "dark" };
    __pxdActions: ActionEvent[];
    __pxdDismissed: number;
    __pxdReady: boolean;
  }
}

window.__pxdActions = [];
window.__pxdDismissed = 0;
const { document: doc, theme, mode } = window.__PXD__;

const shared = {
  document: doc,
  theme,
  mode,
  onAction: (e: ActionEvent) => window.__pxdActions.push(e),
  resolveMedia: (ref: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#999"/><title>${ref}</title></svg>`)}`,
};

createRoot(document.getElementById("root")!).render(
  // A shell renders through PolyxdFrame with a stand-in screen in its outlet: the frame is what is being checked.
  doc.surface.kind === "shell" ? (
    <PolyxdFrame {...shared} current={{ key: doc.components.find((c) => c.component === "Navigation")?.items?.[0]?.key, title: "Screen" }}>
      <h1 className="pxd-surface-title">Screen</h1>
      <p>The current screen renders here.</p>
    </PolyxdFrame>
  ) : (
    <PolyxdSurface {...shared} onDismiss={() => (window.__pxdDismissed += 1)} />
  ),
);
requestAnimationFrame(() => requestAnimationFrame(() => (window.__pxdReady = true)));
