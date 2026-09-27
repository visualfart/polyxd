import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PolyxdSkeleton, PolyxdSurface, type ActionEvent, type ComponentRenderer, type Data, type UIDocument } from "@polyxd/react";
import type { IntentFile, ReportSummary } from "./types.ts";

/**
 * A just-in-time surface inside a product: the document rendered in the product's design system,
 * a small honest "Checked" mark from the verifier, and, behind it, what actually happened: the
 * document, the report, and the same surface in another design system.
 */
export interface JitProps {
  intent: IntentFile;
  report?: ReportSummary;
  /** Surface data, already picked out of the product's data by the intent's pointers. */
  data: Data;
  theme: string;
  mode: "light" | "dark";
  density?: "compact" | "comfortable" | "spacious";
  disclosure?: "progressive" | "show-everything";
  onAction: (e: ActionEvent) => void;
  onDismiss: () => void;
  /** Hears every input change (the renderer's own prop, passed through). */
  onDataChange?: (data: Data) => void;
  /** Derived data after each change: a receipt or a filtered list that follows the inputs. */
  derive?: (data: Data) => Data | void;
  locale?: string;
  /** Renderer overrides for this product. */
  components?: Partial<Record<string, ComponentRenderer>>;
  resolveMedia?: (ref: string) => string | undefined;
  /**
   * How this document came to be, for the mark: generated ahead of time and kept in the product's
   * library, generated just now, or authored by a person as a screen of the product.
   */
  origin: "library" | "live" | "authored";
  /** Other packs the drawer can show the surface in. */
  packs?: { id: string; name: string }[];
  /** Loads a pack's theme CSS on demand (the product only ships its own). */
  loadPack?: (id: string) => Promise<void>;
  className?: string;
}

export function JitSurface({ intent, report, data, theme, mode, density, disclosure, onAction, onDismiss, onDataChange, derive, locale, components, resolveMedia, origin, packs = [], loadPack, className }: JitProps) {
  const [hood, setHood] = useState(false);
  // Remount on new data so the surface starts from the host's copy (it keeps its own while inputs change).
  const key = useMemo(() => intent.id + ":" + fingerprint(JSON.stringify(data)), [data, intent.id]);
  return (
    <div className={["jit", className].filter(Boolean).join(" ")}>
      <PolyxdSurface key={key} document={intent.document} data={data} theme={theme} mode={mode} density={density} disclosure={disclosure} locale={locale} components={components} onAction={onAction} onDismiss={onDismiss} onDataChange={onDataChange} derive={derive} resolveMedia={resolveMedia} />
      <Checked report={report} origin={origin} onOpen={() => setHood(true)} />
      {hood && <Hood intent={intent} report={report} data={data} theme={theme} mode={mode} locale={locale} packs={packs} loadPack={loadPack} resolveMedia={resolveMedia} onClose={() => setHood(false)} />}
    </div>
  );
}

/** FNV-1a over the data's JSON: cheap, and unlike its length it changes when a value does. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/** Shown while a live document is on its way. */
export function JitPending({ title, pattern, theme, mode }: { title?: string; pattern?: string; theme: string; mode: "light" | "dark" }) {
  return (
    <div className="jit">
      <PolyxdSkeleton title={title} pattern={pattern} theme={theme} mode={mode} />
      <p className="jit-mark jit-mark-pending">Writing this screen…</p>
    </div>
  );
}

function Checked({ report, origin, onOpen }: { report?: ReportSummary; origin: "library" | "live" | "authored"; onOpen: () => void }) {
  const packs = report ? new Set(report.targets.map((t) => t.theme)).size : 0;
  const who = origin === "authored" ? "Authored · " : "";
  const text = !report
    ? origin === "live"
      ? "Generated just now · checked against the spec"
      : `${who}Not yet verified`
    : report.errors === 0 && report.warnings === 0
      ? `${who}Checked in ${packs} design systems · no issues`
      : `${who}Checked in ${packs} design systems · ${report.errors} error${report.errors === 1 ? "" : "s"}, ${report.warnings} warning${report.warnings === 1 ? "" : "s"}`;
  return (
    <button type="button" className={`jit-mark${report && report.errors ? " jit-mark-issues" : ""}`} onClick={onOpen} aria-haspopup="dialog">
      <span className="jit-mark-dot" aria-hidden="true" />
      {text}
      <span className="jit-mark-more">Under the hood</span>
    </button>
  );
}

const TABS = [
  ["document", "Document"],
  ["report", "Report"],
  ["packs", "In another design system"],
] as const;

function Hood({ intent, report, data, theme, mode, locale, packs, loadPack, resolveMedia, onClose }: { intent: IntentFile; report?: ReportSummary; data: Data; theme: string; mode: "light" | "dark"; locale?: string; packs: { id: string; name: string }[]; loadPack?: (id: string) => Promise<void>; resolveMedia?: (ref: string) => string | undefined; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("document");
  const [pack, setPack] = useState(packs.find((p) => p.id !== theme)?.id ?? theme);
  const [ready, setReady] = useState<Record<string, boolean>>({ [theme]: true });
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const close = () => latest.current();
    d.addEventListener("close", close);
    return () => d.removeEventListener("close", close);
  }, []);
  useEffect(() => {
    if (ready[pack] || !loadPack) return;
    loadPack(pack).then(() => setReady((r) => ({ ...r, [pack]: true })));
  }, [pack, ready, loadPack]);
  const doc: UIDocument = intent.document;
  return (
    <dialog ref={ref} className="jit-hood" aria-label="Under the hood" onClick={(e) => e.target === ref.current && ref.current.close()}>
      <div className="jit-hood-inner">
        <header className="jit-hood-head">
          <div>
            <h2>Under the hood</h2>
            <p>
              <code>{doc.surface.intent ?? intent.id}</code>
              {doc.surface.pattern && (
                <>
                  {" · pattern "}
                  <code>{doc.surface.pattern}</code>
                </>
              )}
              {" · "}
              {doc.components.length} components
            </p>
          </div>
          <button type="button" className="jit-hood-close" onClick={() => ref.current?.close()}>
            Close
          </button>
        </header>
        <div className="jit-tabs" role="tablist" aria-label="Under the hood">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="jit-tab" onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === "document" && (
          <Panel>
            <p className="jit-note">The whole interface is this JSON: meaning, not pixels. Bindings point at the product's data; actions are declared intents the product decides how to handle.</p>
            <pre className="jit-code">{JSON.stringify(doc, null, 2)}</pre>
          </Panel>
        )}
        {tab === "report" && (
          <Panel>
            {report ? (
              <>
                <p className="jit-note">
                  Verified {new Date(report.checkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} with check set <code>{report.verifier}</code>: schema and data bindings, patterns and capabilities, then a real render in every design system, light and dark, phone and desktop, audited with axe and a layout check.
                </p>
                <table className="jit-table">
                  <thead>
                    <tr>
                      <th scope="col">Design system</th>
                      <th scope="col">Mode</th>
                      <th scope="col">Width</th>
                      <th scope="col">Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.targets.map((t) => (
                      <tr key={`${t.theme}${t.mode}${t.width}`}>
                        <td>{t.theme}</td>
                        <td>{t.mode}</td>
                        <td>{t.width}px</td>
                        <td>{t.findings === 0 ? "none" : t.findings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.findings.length > 0 && (
                  <ul className="jit-findings">
                    {report.findings.map((f, i) => (
                      <li key={i}>
                        <b>{f.severity}</b> {f.check}: {f.message} <i>({f.where})</i>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="jit-note">This document was generated just now and checked against the spec (schema, bindings, patterns, capabilities). The full render audit runs where a browser can: in the product's build, not in yours.</p>
            )}
          </Panel>
        )}
        {tab === "packs" && (
          <Panel>
            <p className="jit-note">Same document, another design system: only the pack changes. Nothing in the JSON knows what it looks like.</p>
            <label className="jit-pack">
              Design system
              <select value={pack} onChange={(e) => setPack(e.target.value)}>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="jit-preview">{ready[pack] ? <PolyxdSurface key={pack} document={doc} data={data} theme={pack} mode={mode} locale={locale} onAction={() => undefined} onDismiss={() => undefined} resolveMedia={resolveMedia} /> : <PolyxdSkeleton title={doc.surface.title} pattern={doc.surface.pattern} theme={theme} mode={mode} />}</div>
          </Panel>
        )}
      </div>
    </dialog>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="jit-panel" role="tabpanel">
      {children}
    </div>
  );
}

/** Pick the surface's data out of the product's data with the intent's pointers. */
export function pickData(source: unknown, pointers: Record<string, string>, fill: Record<string, unknown> = {}): Data {
  const out: Record<string, unknown> = {};
  for (const [key, pointer] of Object.entries(pointers)) out[key] = structuredClone(getPointer(source, pointer));
  for (const [pointer, value] of Object.entries(fill)) setPointer(out, pointer, value);
  return out;
}

function getPointer(obj: unknown, pointer: string): unknown {
  if (pointer === "" || pointer === "/") return obj;
  return pointer
    .split("/")
    .slice(1)
    .reduce<any>((o, k) => (o == null ? undefined : o[k.replace(/~1/g, "/").replace(/~0/g, "~")]), obj);
}
function setPointer(obj: Record<string, unknown>, pointer: string, value: unknown) {
  const parts = pointer.split("/").slice(1);
  let o: any = obj;
  for (const p of parts.slice(0, -1)) o = o[p] ??= {};
  o[parts.at(-1)!] = value;
}
