import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { PolyxdSurface, type ActionEvent, type UIDocument } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "./gallery.css";
import { RankPage } from "./rank.tsx";

// Every theme pack the renderer has compiled, and every example UI document in the spec.
const themeFiles = import.meta.glob("../../../packages/react/themes/*.css", { eager: true });
const exampleFiles = import.meta.glob<{ default: UIDocument }>("../../../packages/spec/examples/*.json", { eager: true });

type Density = "compact" | "comfortable" | "spacious";

const themes = Object.keys(themeFiles).map((p) => p.split("/").pop()!.replace(".css", "")).sort();
const examples = Object.entries(exampleFiles)
  .map(([path, mod]) => ({ file: path.split("/").pop()!.replace(".json", ""), doc: mod.default }))
  .sort((a, b) => a.file.localeCompare(b.file));
const domainOf = (file: string) => file.split("-")[0];
const domains = [...new Set(examples.map((e) => domainOf(e.file)))];

const WIDTHS = { phone: 390, tablet: 768, desktop: 1100 } as const;
const THEME_NAMES: Record<string, string> = { material3: "Material 3", carbon: "Carbon", antd: "Ant Design" };
type Width = keyof typeof WIDTHS;

/** Placeholder images for host media references (generated UIs never contain URLs). */
function placeholder(ref: string) {
  const hue = [...ref].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="hsl(${hue} 45% 78%)"/><circle cx="80" cy="70" r="28" fill="hsl(${hue} 40% 58%)"/><rect x="36" y="112" width="88" height="14" rx="7" fill="hsl(${hue} 40% 58%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function readParam<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const v = new URLSearchParams(location.search).get(name);
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function Gallery() {
  const [file, setFile] = useState(() => readParam("example", examples.map((e) => e.file), examples[0].file));
  const [theme, setTheme] = useState(() => readParam("theme", themes, themes.includes("material3") ? "material3" : themes[0]));
  const [mode, setMode] = useState<"light" | "dark">(() => readParam("mode", ["light", "dark"] as const, "light"));
  const [width, setWidth] = useState<Width>(() => readParam("width", ["phone", "tablet", "desktop"] as const, "desktop"));
  const [density, setDensity] = useState<Density>(() => readParam("density", ["comfortable", "compact", "spacious"] as const, "comfortable"));
  const [panel, setPanel] = useState<"log" | "json">("log");
  const [log, setLog] = useState<{ at: string; text: string }[]>([]);
  const [run, setRun] = useState(0);
  const example = examples.find((e) => e.file === file)!;

  const push = (text: string) => setLog((l) => [{ at: new Date().toLocaleTimeString(), text }, ...l].slice(0, 50));
  const onAction = (e: ActionEvent) => push(`${e.name} ${JSON.stringify(e.context)}  ← ${e.source}`);

  const sync = (patch: Record<string, string>) => {
    const params = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    history.replaceState(null, "", `?${params}`);
  };
  const choose = (f: string) => {
    setFile(f);
    setLog([]);
    sync({ example: f });
  };

  const surface = useMemo(
    () => (
      <PolyxdSurface
        key={`${file}-${run}`}
        document={example.doc}
        theme={theme}
        mode={mode}
        density={density}
        onAction={onAction}
        onDismiss={() => push("ui.dismiss (surface closed)")}
        resolveMedia={placeholder}
      />
    ),
    // Theme and mode change the look only; the surface keeps its state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file, run, theme, mode, density],
  );

  return (
    <>
    <SiteHeader />
    <div className="g-app">
      <nav className="g-sidebar" aria-label="Examples">
        <div className="g-intro">
          <h1>Gallery</h1>
          <p>Every example, rendered live. Switch the design system, mode, density and width; actions the interface sends appear in the inspector.</p>
        </div>
        {domains.map((d) => (
          <div key={d} className="g-domain">
            <div className="g-domain-name">{d}</div>
            <ul>
              {examples
                .filter((e) => domainOf(e.file) === d)
                .map((e) => (
                  <li key={e.file}>
                    <button type="button" aria-current={e.file === file ? "page" : undefined} onClick={() => choose(e.file)}>
                      {e.doc.surface.title}
                      {e.doc.surface.pattern && <span className="g-tag">{e.doc.surface.pattern}</span>}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <main className="g-main">
        <div className="g-toolbar" role="toolbar" aria-label="Preview settings">
          <label>
            Design system
            <select value={theme} onChange={(e) => (setTheme(e.target.value), sync({ theme: e.target.value }))}>
              {themes.map((t) => (
                <option key={t} value={t}>
                  {THEME_NAMES[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <div className="g-seg" role="group" aria-label="Mode">
            {(["light", "dark"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => (setMode(m), sync({ mode: m }))}>
                {m}
              </button>
            ))}
          </div>
          <div className="g-seg" role="group" aria-label="Density">
            {(["compact", "comfortable", "spacious"] as const).map((d) => (
              <button key={d} type="button" aria-pressed={density === d} onClick={() => (setDensity(d), sync({ density: d }))}>
                {d}
              </button>
            ))}
          </div>
          <div className="g-seg" role="group" aria-label="Width">
            {(Object.keys(WIDTHS) as Width[]).map((w) => (
              <button key={w} type="button" aria-pressed={width === w} onClick={() => (setWidth(w), sync({ width: w }))}>
                {w}
              </button>
            ))}
          </div>
          <button type="button" className="g-reset" onClick={() => (setRun((r) => r + 1), setLog([]))}>
            Reset
          </button>
          <span className="g-meta">
            <span>intent</span> <code>{example.doc.surface.intent}</code>
          </span>
        </div>

        <div className="g-stage">
          <div className="g-frame" style={{ width: WIDTHS[width] }}>
            {surface}
          </div>
        </div>
      </main>

      <aside className="g-panel" aria-label="Inspector">
        <div className="g-seg" role="tablist">
          <button type="button" role="tab" aria-selected={panel === "log"} onClick={() => setPanel("log")}>
            Actions ({log.length})
          </button>
          <button type="button" role="tab" aria-selected={panel === "json"} onClick={() => setPanel("json")}>
            UI document
          </button>
        </div>
        {panel === "log" ? (
          <ol className="g-log" aria-live="polite">
            {log.length === 0 && <li className="g-empty">Actions the UI sends to the host appear here.</li>}
            {log.map((l, i) => (
              <li key={i}>
                <time>{l.at}</time> {l.text}
              </li>
            ))}
          </ol>
        ) : (
          <pre className="g-json">{JSON.stringify({ ...example.doc, data: undefined }, null, 2)}</pre>
        )}
      </aside>
    </div>
    </>
  );
}

const LOGO = (
  <svg width="30" height="25" viewBox="0 0 34 28" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="18" height="18" rx="9" stroke="currentColor" strokeWidth="2" />
    <rect x="8" y="5" width="18" height="18" stroke="currentColor" strokeWidth="2" />
    <rect x="15" y="9" width="18" height="18" rx="4" fill="#FF5A1F" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/** The same header as polyxd.com, so the gallery reads as part of the site. */
function SiteHeader() {
  return (
    <header className="g-header">
      <a className="g-brand" href="/" aria-label="Polyxd home">
        {LOGO}
        <span>polyxd</span>
      </a>
      <nav className="g-nav" aria-label="Main">
        <a className="g-nav-optional" href="/#how">How it works</a>
        <a className="g-nav-optional" href="/#agents">People &amp; agents</a>
        <a className="g-nav-optional" href="/#taste">For design teams</a>
        <a href="/gallery/" aria-current="page">Gallery</a>
        <a href="/docs/">Docs</a>
        <a className="g-cta" href="/#access">Early access</a>
      </nav>
    </header>
  );
}

const ranking = new URLSearchParams(location.search).has("rank");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {ranking ? (
      <>
        <SiteHeader />
        <RankPage />
      </>
    ) : (
      <Gallery />
    )}
  </StrictMode>,
);
