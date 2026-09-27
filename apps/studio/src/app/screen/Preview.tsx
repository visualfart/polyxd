/**
 * The document drawn for real with @polyxd/react, in the workspace's design system or a built-in
 * theme, at a chosen width. A click picks the component under the pointer; in "interact" mode
 * clicks reach the surface instead and actions are reported rather than sent anywhere.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { PolyxdSurface, type ActionEvent, type UIDocument } from "@polyxd/react";
import type { Doc } from "../../screens/schema.ts";

export interface PreviewTheme {
  /** Built-in theme whose CSS is loaded: drawn as is, or as the base under the workspace's variables. */
  base: string;
  /** The workspace design system's --pxd-* variables for the current mode, when previewing in it. */
  vars?: Record<string, string>;
}

export const WIDTHS: { id: string; label: string; width: number | null }[] = [
  { id: "phone", label: "Phone", width: 390 },
  { id: "tablet", label: "Tablet", width: 820 },
  { id: "desktop", label: "Desktop", width: null },
];

export function Preview({ doc, dataKey, selected, hovered, onSelect, onHover, theme, mode, width, density, interact, onAction }: { doc: Doc; dataKey: string; selected: string | null; hovered: string | null; onSelect: (id: string | null) => void; onHover: (id: string | null) => void; theme: PreviewTheme; mode: "light" | "dark"; width: number | null; density: "compact" | "comfortable" | "spacious"; interact: boolean; onAction: (e: ActionEvent) => void }) {
  const [crashed, setCrashed] = useState<string | null>(null);
  const idAt = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-pxd-id]")?.getAttribute("data-pxd-id") ?? null : null);
  // Remount when the data changes, so the surface starts again from the document's copy.
  const key = `${dataKey}:${theme.base}:${!!theme.vars}:${mode}`;
  const style = useMemo(() => ({ ...(theme.vars ?? {}), width: width ?? "100%" }) as CSSProperties, [theme.vars, width]);
  return (
    <div className="scr-canvas" data-mode={mode} data-interact={interact} onMouseLeave={() => onHover(null)}>
      <div
        className="scr-frame"
        data-pxd-theme={theme.base}
        data-pxd-mode={mode}
        style={style}
        onClickCapture={(e) => {
          if (interact) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect(idAt(e.target));
        }}
        onMouseMoveCapture={(e) => !interact && onHover(idAt(e.target))}
      >
        {selected && <style>{`.scr-frame [data-pxd-id="${cssEscape(selected)}"]{outline:2px solid var(--signal)!important;outline-offset:3px;border-radius:3px}`}</style>}
        {hovered && hovered !== selected && !interact && <style>{`.scr-frame [data-pxd-id="${cssEscape(hovered)}"]{outline:1px dashed var(--signal)!important;outline-offset:3px}`}</style>}
        {crashed ? (
          <div className="notice bad" style={{ margin: 16 }}><div className="body"><b>The renderer couldn't draw this</b>{crashed}. Fix the document (see Issues) and the preview comes back.</div></div>
        ) : (
          <Boundary key={key} onError={(m) => setCrashed(m)} reset={() => setCrashed(null)} docKey={JSON.stringify(doc.components).length}>
            <PolyxdSurface key={key} document={doc as unknown as UIDocument} theme={theme.vars ? undefined : theme.base} mode={mode} density={density} onAction={onAction} onDismiss={() => onAction({ name: "ui.dismiss", context: {}, source: doc.surface.id })} />
          </Boundary>
        )}
      </div>
    </div>
  );
}

const cssEscape = (s: string) => s.replace(/["\\]/g, "\\$&");

import { Component, type ErrorInfo, type ReactNode } from "react";

/** Catches a renderer error for one document state and lets the next change try again. */
class Boundary extends Component<{ children: ReactNode; onError: (m: string) => void; reset: () => void; docKey: number }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error, _info: ErrorInfo) {
    this.props.onError(e.message);
  }
  componentDidUpdate(prev: { docKey: number }) {
    if (this.state.failed && prev.docKey !== this.props.docKey) {
      this.setState({ failed: false });
      this.props.reset();
    }
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
