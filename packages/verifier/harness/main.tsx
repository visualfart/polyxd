/**
 * Verifier harness: renders one UI document with one theme, and records what the UI sends to the host.
 * The verifier injects window.__PXD__ = { document, theme, mode } before the page loads.
 */
import { createRoot } from "react-dom/client";
import { PolyxdSurface, type ActionEvent, type UIDocument } from "@polyxd/react";
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

createRoot(document.getElementById("root")!).render(
  <PolyxdSurface
    document={doc}
    theme={theme}
    mode={mode}
    onAction={(e) => window.__pxdActions.push(e)}
    onDismiss={() => (window.__pxdDismissed += 1)}
    resolveMedia={(ref) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#999"/><title>${ref}</title></svg>`)}`}
  />,
);
requestAnimationFrame(() => requestAnimationFrame(() => (window.__pxdReady = true)));
