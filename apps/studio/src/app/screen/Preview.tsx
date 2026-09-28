/**
 * The document drawn for real with @polyxd/react, in the workspace's design system or a built-in
 * theme, at a chosen width. A click picks the component under the pointer; in "interact" mode
 * clicks reach the surface instead and actions are reported rather than sent anywhere.
 *
 * A shell document (surface.kind "shell") is drawn with PolyxdFrame, the way a product renders
 * it, with a stand-in screen in its Outlet: a placeholder, or one of the workspace's published
 * screens. The Frame measures its own width, so the phone, tablet and desktop widths show the
 * navigation as a bar, a rail or a side column.
 *
 * A surface wider than the canvas is shown whole, scaled down the way the gallery does it (CSS zoom
 * keeps its layout at the width it says). A shell isn't scaled: the Frame picks its layout from
 * its measured width, which zoom would shrink into a phone's. It fills the canvas's height rather
 * than the browser's, so its footer is in view, and the canvas scrolls both ways for the rest.
 */
import { Component, useEffect, useMemo, useRef, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { PolyxdFrame, PolyxdSurface, type ActionEvent, type UIDocument } from "@polyxd/react";
import { isShell, type Doc } from "../../screens/schema.ts";

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

/** What a shell's Outlet shows when no published screen is chosen: a Group with one line of text. */
export const STAND_IN: Doc = {
  specVersion: "0.3.0",
  surface: { id: "stand-in", title: "Your screens render here", origin: "authored" },
  root: "stand-in",
  components: [
    { id: "stand-in", component: "Group", children: ["stand-in-text"] },
    { id: "stand-in-text", component: "Text", text: "Your screens render here: a published screen of this workspace, or whatever your product puts in the Outlet." },
  ],
  data: {},
};

export function Preview({ doc, dataKey, selected, hovered, onSelect, onHover, theme, mode, width, density, interact, onAction, standIn }: { doc: Doc; dataKey: string; selected: string | null; hovered: string | null; onSelect: (id: string | null) => void; onHover: (id: string | null) => void; theme: PreviewTheme; mode: "light" | "dark"; width: number | null; density: "compact" | "comfortable" | "spacious"; interact: boolean; onAction: (e: ActionEvent) => void; standIn?: Doc | null }) {
  const [crashed, setCrashed] = useState<string | null>(null);
  const ids = useMemo(() => new Set(doc.components.map((c) => c.id)), [doc]);
  // The stand-in screen's own components are not this document's; a click on them selects nothing.
  const idAt = (t: EventTarget | null) => {
    const id = t instanceof Element ? t.closest("[data-pxd-id]")?.getAttribute("data-pxd-id") ?? null : null;
    return id && ids.has(id) ? id : null;
  };
  const shell = isShell(doc);
  const inOutlet = standIn ?? STAND_IN;
  // Remount when the data changes, so the surface starts again from the document's copy.
  const key = `${dataKey}:${theme.base}:${!!theme.vars}:${mode}:${shell ? inOutlet.surface.id : ""}`;
  // A shell at desktop width lays out at the width a Frame needs for its side navigation (1024px and
  // up), so a narrow window scrolls sideways rather than showing a rail and calling it desktop. A
  // surface wider than the canvas is zoomed to fit (not below half size; past that it scrolls).
  const canvas = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setRoom({ width: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), height: el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lays = width ?? (shell ? Math.max(SHELL_DESKTOP, room?.width ?? 0) : null);
  const fit = !shell && lays && room && room.width > 0 ? Math.max(0.5, Math.min(1, room.width / lays)) : 1;
  const wider = !!lays && !!room && lays > room.width + 1 && fit === 1;
  const style = useMemo(() => ({
    ...(theme.vars ?? {}),
    width: lays ?? "100%",
    ...(lays ? { maxWidth: "none", flexShrink: 0 } : {}),
    ...(fit < 1 ? { zoom: fit } : {}),
    // The shell fills what the canvas shows, in the frame's own (unzoomed) pixels.
    ...(shell && room ? { "--scr-fill": `${Math.floor(room.height / fit) - 2}px` } : {}),
  }) as CSSProperties, [theme.vars, lays, fit, shell, room]);
  const themeProp = theme.vars ? undefined : theme.base;
  return (
    <div className="scr-canvas" ref={canvas} data-mode={mode} data-interact={interact} onMouseLeave={() => onHover(null)}>
      {fit < 1 && <span className="scr-fit" title={`Laid out at ${lays}px, shown at ${Math.round(fit * 100)}% to fit`}>{lays}px · {Math.round(fit * 100)}%</span>}
      {wider && <span className="scr-fit" title="Wider than the canvas: scroll sideways for the rest">{lays}px · scroll for the rest</span>}
      <div
        className="scr-frame"
        data-pxd-theme={theme.base}
        data-pxd-mode={mode}
        data-shell={shell || undefined}
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
            {shell ? (
              <PolyxdFrame key={key} document={doc as unknown as UIDocument} theme={themeProp} mode={mode} density={density} onAction={onAction} current={{ key: currentNav(doc), title: inOutlet.surface.title }}>
                <PolyxdSurface document={inOutlet as unknown as UIDocument} theme={themeProp} mode={mode} density={density} onAction={onAction} onDismiss={() => onAction({ name: "ui.dismiss", context: {}, source: inOutlet.surface.id })} />
              </PolyxdFrame>
            ) : (
              <PolyxdSurface key={key} document={doc as unknown as UIDocument} theme={themeProp} mode={mode} density={density} onAction={onAction} onDismiss={() => onAction({ name: "ui.dismiss", context: {}, source: doc.surface.id })} />
            )}
          </Boundary>
        )}
      </div>
    </div>
  );
}

/** How wide the frame lays out: the chosen width, or for a shell at desktop the 1100px its side navigation needs. */
const SHELL_DESKTOP = 1100;

/** The navigation item the shell's sample data says is current, so the preview marks it. */
function currentNav(doc: Doc): string | undefined {
  const nav = doc.components.find((c) => c.component === "Navigation" && c.kind === "main") ?? doc.components.find((c) => c.component === "Navigation");
  const cur = nav?.current;
  if (typeof cur === "string") return cur;
  if (cur && typeof cur === "object" && typeof cur.path === "string" && cur.path.startsWith("/")) {
    let v: any = doc.data;
    for (const part of cur.path.slice(1).split("/")) v = v && typeof v === "object" ? v[part] : undefined;
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

const cssEscape = (s: string) => s.replace(/["\\]/g, "\\$&");

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
