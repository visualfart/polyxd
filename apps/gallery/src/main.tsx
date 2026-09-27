import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { PolyxdSurface, type ActionEvent, type UIDocument } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "./gallery.css";
import { RankPage } from "./rank.tsx";
import { Cluster, Icon, PackPicker, Segmented, type Pack } from "./ui.tsx";

// Every theme pack the renderer has compiled, and every example UI document in the spec.
const themeFiles = import.meta.glob("../../../packages/react/themes/*.css", { eager: true });
const exampleFiles = import.meta.glob<{ default: UIDocument }>("../../../packages/spec/examples/*.json", { eager: true });

type Density = "compact" | "comfortable" | "spacious";

const themes = Object.keys(themeFiles).map((p) => p.split("/").pop()!.replace(".css", "")).sort();
const examples = Object.entries(exampleFiles)
  .map(([path, mod]) => ({ file: path.split("/").pop()!.replace(".json", ""), doc: mod.default }))
  .sort((a, b) => a.file.localeCompare(b.file));
const domainOf = (file: string) => file.split("-")[0];

const WIDTHS = { phone: 390, tablet: 768, desktop: 1100 } as const;
type Width = keyof typeof WIDTHS;

/** Who each pack comes from. Its colour and typeface come from the pack's own tokens at runtime. */
const PACK_INFO: Record<string, { name: string; by: string }> = {
  material3: { name: "Material 3", by: "Google · Roboto" },
  carbon: { name: "Carbon", by: "IBM · IBM Plex Sans" },
  antd: { name: "Ant Design", by: "Ant Group" },
  fluent: { name: "Fluent 2", by: "Microsoft · Segoe UI" },
  shadcn: { name: "shadcn/ui", by: "Tailwind CSS v4" },
  bootstrap: { name: "Bootstrap 5", by: "Bootstrap team" },
  mantine: { name: "Mantine 8", by: "Mantine" },
  radix: { name: "Radix Themes", by: "WorkOS · indigo" },
  polaris: { name: "Shopify Polaris", by: "Shopify · Inter" },
  primer: { name: "GitHub Primer", by: "GitHub · Mona Sans" },
  spectrum: { name: "Adobe Spectrum 2", by: "Adobe · Source Sans" },
  govuk: { name: "GOV.UK Frontend", by: "GDS · one theme, no dark" },
  chakra: { name: "Chakra UI 3", by: "Chakra · Inter" },
};
/** Original Polyxd templates: not reproductions of anyone's system, meant to be copied and changed. Listed after the real systems, under their own heading. */
const TEMPLATE_INFO: Record<string, { name: string; by: string }> = {
  sketch: { name: "Sketch", by: "Hand-drawn · Caveat, Patrick Hand" },
  wireframe: { name: "Wireframe", by: "Low-fidelity · greys, dashed, mono" },
  editorial: { name: "Editorial", by: "Serif display · Fraunces" },
  brutalist: { name: "Brutalist", by: "Black, yellow, hard shadows" },
  glass: { name: "Glass", by: "Translucent · cool, 20px" },
  terminal: { name: "Terminal", by: "Dark · JetBrains Mono, green" },
  pastel: { name: "Pastel", by: "Mint, lavender, peach · Nunito" },
  civic: { name: "Civic", by: "Plain, high-contrast, large" },
  finance: { name: "Finance", by: "Navy and gold · dense tables" },
  health: { name: "Health", by: "Calm teal, cream · roomy" },
  neon: { name: "Neon", by: "Dark · magenta, cyan · Space Grotesk" },
  mono: { name: "Mono", by: "One hue in every role · indigo" },
};
const packs: Pack[] = [
  ...themes.filter((key) => !(key in TEMPLATE_INFO)).map((key) => ({ key, group: "Design systems", ...(PACK_INFO[key] ?? { name: key, by: "Design system pack" }) })),
  ...Object.keys(TEMPLATE_INFO).filter((key) => themes.includes(key)).map((key) => ({ key, group: "Templates", ...TEMPLATE_INFO[key] })),
];

/** Example files are named <domain>-<thing>; these are the words people use for those domains. */
const GROUP_NAMES: Record<string, string> = {
  money: "Money",
  crm: "Work",
  tasks: "Tasks",
  shop: "Shopping",
  travel: "Travel",
  calendar: "Calendar",
  personal: "Personal",
  settings: "Settings",
  error: "Errors",
};
const GROUP_ORDER = Object.keys(GROUP_NAMES);
const WIDTH_OPTIONS = [
  { key: "phone" as Width, text: "Phone", icon: "phone" },
  { key: "tablet" as Width, text: "Tablet", icon: "tablet" },
  { key: "desktop" as Width, text: "Desktop", icon: "desktop" },
];
const DENSITY_OPTIONS = [
  { key: "compact" as Density, text: "Compact rows", icon: "rowsTight" },
  { key: "comfortable" as Density, text: "Default rows", icon: "rowsMid" },
  { key: "spacious" as Density, text: "Roomy rows", icon: "rowsLoose" },
];
const MODE_OPTIONS = [
  { key: "light" as const, text: "Light", icon: "sun" },
  { key: "dark" as const, text: "Dark", icon: "moon" },
];

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
  // A phone opens on the phone preview: a 1100px frame on a 375px screen is a horizontal scrollbar
  // with a corner of a UI in it. Picking a wider frame still works and still scrolls the stage.
  const [width, setWidth] = useState<Width>(() =>
    readParam("width", ["phone", "tablet", "desktop"] as const, typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches ? "phone" : "desktop"),
  );
  const [density, setDensity] = useState<Density>(() => readParam("density", ["comfortable", "compact", "spacious"] as const, "comfortable"));
  const [panel, setPanel] = useState<"log" | "json">("log");
  const [search, setSearch] = useState("");
  const [log, setLog] = useState<{ at: string; name: string; context: string }[]>([]);
  const [run, setRun] = useState(0);
  const example = examples.find((e) => e.file === file)!;

  const push = (name: string, context: unknown) => setLog((l) => [{ at: new Date().toLocaleTimeString(), name, context: JSON.stringify(context) }, ...l].slice(0, 50));
  const onAction = (e: ActionEvent) => push(e.name, e.context);

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
        onDismiss={() => push("ui.dismiss", { surface: example.doc.surface.id })}
        resolveMedia={placeholder}
      />
    ),
    // Theme and mode change the look only; the surface keeps its state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [file, run, theme, mode, density],
  );

  const query = search.trim().toLowerCase();
  const matches = examples.filter((e) => !query || e.doc.surface.title.toLowerCase().includes(query) || e.file.includes(query) || (e.doc.surface.intent ?? "").includes(query));
  const groups = [...new Set(matches.map((e) => domainOf(e.file)))]
    .sort((a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99))
    .map((d) => ({ key: d, name: GROUP_NAMES[d] ?? d, items: matches.filter((e) => domainOf(e.file) === d) }));
  const caption = [example.doc.surface.title, example.doc.surface.intent, example.doc.surface.pattern].filter(Boolean).join(" · ");

  return (
    <>
    <SiteHeader />
    <div className="g-app">
      <nav className="g-sidebar" aria-label="Examples">
        <label className="g-search">
          <Icon name="search" size={16} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search examples" aria-label={`Search ${examples.length} examples`} />
        </label>
        <div className="g-groups">
          {groups.map((g) => (
            <div key={g.key} className="g-group">
              <div className="g-group-head">
                <h2>{g.name}</h2>
                <span className="g-count">{g.items.length}</span>
              </div>
              <ul>
                {g.items.map((e) => (
                  <li key={e.file}>
                    <button type="button" aria-current={e.file === file ? "page" : undefined} onClick={() => choose(e.file)}>
                      {e.doc.surface.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {groups.length === 0 && <p className="g-empty">No example matches “{search}”.</p>}
        </div>
      </nav>

      <main className="g-main">
        <div className="g-toolbar" role="toolbar" aria-label="Preview settings">
          <Cluster label="Design system">
            <PackPicker packs={packs} value={theme} onChange={(t) => (setTheme(t), sync({ theme: t }))} />
          </Cluster>
          <Cluster label="Mode">
            <Segmented label="Mode" options={MODE_OPTIONS} value={mode} onChange={(m) => (setMode(m), sync({ mode: m }))} showText={false} />
          </Cluster>
          <Cluster label="Density">
            <Segmented label="Density" options={DENSITY_OPTIONS} value={density} onChange={(d) => (setDensity(d), sync({ density: d }))} showText={false} />
          </Cluster>
          <Cluster label="Width">
            <Segmented label="Width" options={WIDTH_OPTIONS} value={width} onChange={(w) => (setWidth(w), sync({ width: w }))} showText={false} />
          </Cluster>
        </div>

        <div className="g-stage">
          <div className="g-stage-inner" data-width={width}>
          <div className="g-caption" style={{ width: WIDTHS[width] }}>
            <span className="g-caption-text">{caption}</span>
            <span className="g-caption-width">{WIDTHS[width]}px</span>
            <button type="button" className="g-reset" onClick={() => (setRun((r) => r + 1), setLog([]))}>
              <Icon name="reset" size={15} />
              Reset
            </button>
          </div>
          <div className="g-frame" style={{ width: WIDTHS[width] }}>
            {surface}
          </div>
          </div>
        </div>
      </main>

      <aside className="g-panel" aria-label="Inspector">
        <div className="g-seg g-panel-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={panel === "log"} onClick={() => setPanel("log")}>
            <Icon name="bolt" size={16} />
            <span>Actions{log.length > 0 ? ` (${log.length})` : ""}</span>
          </button>
          <button type="button" role="tab" aria-selected={panel === "json"} onClick={() => setPanel("json")}>
            <Icon name="code" size={16} />
            <span>Document</span>
          </button>
        </div>
        <p className="g-panel-note">What this interface sends to the host app.</p>
        {panel === "log" ? (
          <ol className="g-log" aria-live="polite">
            {log.length === 0 && <li className="g-empty">Use the interface; what it sends appears here.</li>}
            {log.map((l, i) => (
              <li key={i}>
                <span className="g-log-head">
                  <code>{l.name}</code>
                  <time>{l.at}</time>
                </span>
                <code className="g-log-context">{l.context}</code>
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
