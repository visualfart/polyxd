/**
 * Insights: how the workspace's screens do in its products, from the semantic events those
 * products send (src/worker/insights.ts). A table of intents over 7, 30 or 90 days, and a page per
 * intent with its days drawn by Polyxd's own Chart, its funnel, its input errors, and generated
 * screens beside authored ones. Every figure is a daily count; nothing here is an event.
 */
import { Component, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "@polyxd/react/styles.css";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";
import { api } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { loadTheme, workspaceTheme } from "../screen/theme.ts";
import type { PreviewTheme } from "../screen/Preview.tsx";
import type { IntentDetail, IntentSummary, Measures, Ranked } from "../../insights/report.ts";
import { OTHER } from "../../insights/events.ts";
import "../insights.css";

const RANGES = [7, 30, 90] as const;
const CAN_MANAGE_KEYS = new Set(["owner", "engineer", "design-system", "product"]);

interface Overview {
  days: number;
  from: string;
  to: string;
  retentionDays: number;
  ingestKeys: number;
  lastReceived: string | null;
  ever: boolean;
  totals: Measures;
  intents: IntentSummary[];
  screens: Record<string, { key: string; name: string }[]>;
}
type Detail = IntentDetail & { days: number; from: string; to: string; retentionDays: number; screens: { key: string; name: string }[] };
interface IngestKey { id: string; name: string; key: string; created_at: string; last_used_at: string | null }

const n = (v: number) => v.toLocaleString("en-GB");
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);
const seconds = (ms: number) => (ms < 60_000 ? `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);
const rating = (f: Measures["feedback"]) => (f ? `${f.average >= 0 ? "+" : "−"}${Math.abs(f.average).toFixed(2)}` : "—");
const intentLabel = (i: string) => (i === OTHER ? "Everything else" : i);

function useRange(): [number, (d: number) => void] {
  const [params, setParams] = useSearchParams();
  const d = Number(params.get("days"));
  const days = RANGES.includes(d as (typeof RANGES)[number]) ? d : 30;
  return [days, (next) => setParams((p) => { p.set("days", String(next)); return p; }, { replace: true })];
}

function RangePicker({ days, set }: { days: number; set: (d: number) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Range">
      {RANGES.map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => set(d)}>{d} days</button>)}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat ins-stat">
      <span className="small muted">{label}</span>
      <span className="v num">{value}</span>
      {sub && <span className="small muted">{sub}</span>}
    </div>
  );
}

function Rate({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="small muted">no task</span>;
  return (
    <span className="ins-rate">
      <span className="meter" aria-hidden="true"><i style={{ width: `${Math.round(rate * 100)}%` }} /></span>
      <span className="num">{pct(rate)}</span>
    </span>
  );
}

// ---------------------------------------------------------------- the list

export function Insights({ ws }: { ws: Ws }) {
  const navigate = useNavigate();
  const { toast } = useSession();
  const [days, setDays] = useRange();
  const [data, setData] = useState<Overview | null>(null);
  const [setup, setSetup] = useState(false);
  const load = () => api<Overview>("GET", `/api/w/${ws.slug}/insights?days=${days}`).then(setData).catch((e) => toast((e as Error).message, "bad"));
  useEffect(() => {
    load();
  }, [ws.slug, days]);
  if (!data) return null;
  const t = data.totals;
  const lede = "How your screens do in your product, counted each day from the semantic events it sends. Studio keeps the counts, never the events.";

  if (!data.ever) {
    return (
      <Page crumbs={[ws.name, "Product", "Insights"]} title="Insights" lede={lede}>
        <div className="ins-empty">
          <div className="ins-empty-head">
            <h2>No events yet</h2>
            <p>Your product's renderer already knows what people do with each screen: shown, acted on, completed, abandoned, where an input was refused. Point it at Studio and this page fills in.</p>
          </div>
          <Setup ws={ws} onKey={load} />
        </div>
      </Page>
    );
  }

  const deleteAll = async () => {
    if (!window.confirm(`Delete every Insights count for ${ws.name}? This can't be undone. Your products can keep sending; counting starts again from nothing.`)) return;
    await api("DELETE", `/api/w/${ws.slug}/insights`);
    toast("Insights counts deleted");
    load();
  };

  return (
    <Page crumbs={[ws.name, "Product", "Insights"]} title="Insights" lede={lede} actions={<><RangePicker days={days} set={setDays} /><button type="button" className="btn" onClick={() => setSetup(true)}>Send events</button></>}>
      <div className="grid-4">
        <Stat label="Shown" value={n(t.shown)} sub={`screens on screen, last ${days} days`} />
        <Stat label="Completed" value={n(t.completed)} sub={`${pct(t.completionRate)} of screens with a task`} />
        <Stat label="Abandoned" value={n(t.abandoned)} sub="left after starting" />
        <Stat label="Input errors" value={n(t.inputErrors)} sub={t.shown ? `${(t.inputErrors / t.shown).toFixed(2)} per screen shown` : undefined} />
      </div>
      {!data.intents.length ? (
        <div className="card"><h2>Nothing in the last {days} days</h2><p>Events arrived before this range. Pick a longer one.</p></div>
      ) : (
        <div className="card ins-table-card">
          <table className="ins-table">
            <thead>
              <tr><th>Intent</th><th className="r">Shown</th><th className="r">Completed</th><th className="r">Abandoned</th><th>Completion</th><th>Time to complete</th><th>Input errors</th><th className="r">Status</th><th className="r">Undo</th><th className="r">Feedback</th></tr>
            </thead>
            <tbody>
              {data.intents.map((i) => {
                const screens = data.screens[i.intent] ?? [];
                return (
                  <tr key={i.intent} className="row-link" onClick={() => navigate(`/w/${ws.slug}/insights/${encodeURIComponent(i.intent)}?days=${days}`)}>
                    <td>
                      <Link to={`/w/${ws.slug}/insights/${encodeURIComponent(i.intent)}?days=${days}`} className="ins-intent mono" onClick={(e) => e.stopPropagation()}>{intentLabel(i.intent)}</Link>
                      <div className="small muted ins-sub">
                        {screens.length ? screens.map((s) => s.name).join(", ") : `${i.surfaces.length} surface${i.surfaces.length === 1 ? "" : "s"}`}
                        {i.sources.map((s) => <span key={s} className={`tag ${s === "generated" ? "signal" : ""}`}>{s}</span>)}
                      </div>
                    </td>
                    <td className="r num">{n(i.shown)}</td>
                    <td className="r num">{n(i.completed)}</td>
                    <td className="r num">{n(i.abandoned)}</td>
                    <td><Rate rate={i.completionRate} /></td>
                    <td>{i.time ? <><span className="num">{i.time.median}</span><div className="small muted">mean {seconds(i.time.meanMs)}</div></> : <span className="muted">—</span>}</td>
                    <td>
                      <span className="num">{n(i.inputErrors)}</span>
                      {i.topInputErrors[0] && <div className="small muted mono">{i.topInputErrors[0].component || "unnamed"} · {i.topInputErrors[0].reason || "invalid"}</div>}
                    </td>
                    <td className="r num">{n(i.statusShown)}</td>
                    <td className="r num">{n(i.undo)}</td>
                    <td className="r num">{rating(i.feedback)}{i.feedback && <div className="small muted">{n(i.feedback.count)} rating{i.feedback.count === 1 ? "" : "s"}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted ins-foot">
        Completion is tasks completed for every time a screen with that intent was shown; a screen with no task to finish has none. Time to complete is the range the median falls in, and the mean.
        Counts are kept for {data.retentionDays} days, by day (UTC). {data.lastReceived ? `Events last arrived ${new Date(data.lastReceived).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : ""}
        {ws.role === "owner" && <> <button type="button" className="ins-link" onClick={deleteAll}>Delete all counts</button></>}
      </p>
      {setup && (
        <>
          <div className="drawer-scrim" onClick={() => setSetup(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Send events" style={{ width: 640 }}>
            <header><h2>Send events to Insights</h2><button type="button" className="btn ghost sm" onClick={() => setSetup(false)}>Close</button></header>
            <div className="body"><Setup ws={ws} onKey={load} /></div>
          </div>
        </>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- how to send events

function Setup({ ws, onKey }: { ws: Ws; onKey: () => void }) {
  const { toast } = useSession();
  const [keys, setKeys] = useState<IngestKey[] | null>(null);
  const [flavour, setFlavour] = useState<"react" | "web">("react");
  const load = () => api<{ keys: IngestKey[] }>("GET", `/api/w/${ws.slug}/ingest-keys`).then((r) => setKeys(r.keys));
  useEffect(() => {
    load();
  }, [ws.slug]);
  const make = async () => {
    try {
      await api("POST", `/api/w/${ws.slug}/ingest-keys`, { name: "Product events" });
      await load();
      onKey();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const key = keys?.[0]?.key ?? "<your ingest key>";
  const url = `${location.origin}/api/w/${ws.slug}/events`;
  const send = `import { toFetch } from "@polyxd/analytics";\n\n// Make it once, outside your components. It sends events in batches,\n// and whatever is left when the page is hidden.\nconst studio = toFetch("${url}", {\n  headers: { "x-polyxd-key": "${key}" },\n});`;
  const react = `${send}\n\n<PolyxdSurface\n  document={doc}\n  onEvent={studio}\n  events={{ generator: "your-model@1" }} // leave out for authored screens\n/>`;
  const web = `${send}\n\nconst el = document.querySelector("polyxd-surface");\nel.onEvent = studio;\nel.events = { generator: "your-model@1" }; // leave out for authored screens`;
  return (
    <ol className="ins-steps">
      <li>
        <span className="ins-step-n" aria-hidden="true">1</span>
        <div>
          <h3>An ingest key</h3>
          <p className="muted">It can send events to {ws.name}'s Insights and nothing else, so it is safe in your product's pages.</p>
          {keys === null ? null : keys.length ? (
            <code className="ins-key mono" style={{ userSelect: "all" }}>{keys[0].key}</code>
          ) : CAN_MANAGE_KEYS.has(ws.role) ? (
            <button type="button" className="btn primary" onClick={make}>Make an ingest key</button>
          ) : (
            <p className="small">Ask an owner, engineer or product person in {ws.name} to make one in Team.</p>
          )}
          {!!keys?.length && <p className="small muted">Manage keys in <Link to={`/w/${ws.slug}/team`}>Team</Link>.</p>}
        </div>
      </li>
      <li>
        <span className="ins-step-n" aria-hidden="true">2</span>
        <div style={{ minWidth: 0 }}>
          <h3>Hand your renderer's events to Studio</h3>
          <div className="segmented" role="group" aria-label="Renderer">
            <button type="button" aria-pressed={flavour === "react"} onClick={() => setFlavour("react")}>React</button>
            <button type="button" aria-pressed={flavour === "web"} onClick={() => setFlavour("web")}>Web Components</button>
          </div>
          <pre className="ins-code" tabIndex={0}><code>{flavour === "react" ? react : web}</code></pre>
          <p className="small muted">Name the generator on generated screens and Insights compares them with the screens your team authored. To send to your own analytics as well, call both from one handler.</p>
        </div>
      </li>
      <li>
        <span className="ins-step-n" aria-hidden="true">3</span>
        <div>
          <h3>What Studio keeps</h3>
          <p className="muted">Counts per day, by intent, screen, pattern, event type, component key, capability and reason code. Never the events themselves, the values people type, session ids or times of day. Kept for 90 days.</p>
        </div>
      </li>
    </ol>
  );
}

// ---------------------------------------------------------------- one intent

class Guard extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const dayMonth = (day: string, month: boolean) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", ...(month ? { month: "short" } : {}), timeZone: "UTC" });

/**
 * The range as a Polyxd document: one trend Chart, drawn by @polyxd/react in the workspace's design
 * system. Up to 30 days a point is a day; 90 days are summed by week, so the axis stays legible
 * (the Chart labels every point). A label names the month on the first point and where it changes.
 */
function chartDocument(d: Detail): UIDocument {
  const weekly = d.series.length > 31;
  const points: { day: string; shown: number; completed: number; abandoned: number }[] = [];
  // Whole weeks ending today; the days before the first whole week are left off, as a part week would read as a dip.
  const days = weekly ? d.series.slice(d.series.length % 7) : d.series;
  days.forEach((s, i) => {
    if (!weekly || i % 7 === 0) points.push({ day: s.day, shown: 0, completed: 0, abandoned: 0 });
    const p = points[points.length - 1];
    p.shown += s.shown;
    p.completed += s.completed;
    p.abandoned += s.abandoned;
  });
  // The month is named where it changes, and on the first point unless a change is close enough to crowd it.
  const changes = points.map((p, i) => i > 0 && p.day.slice(5, 7) !== points[i - 1].day.slice(5, 7));
  const firstChange = changes.indexOf(true);
  const rows = points.map((p, i) => ({ ...p, label: dayMonth(p.day, changes[i] || (i === 0 && (firstChange === -1 || firstChange >= 3))) }));
  const most = d.series.reduce((m, s) => (s.shown > m.shown ? s : m), d.series[0]);
  const summary = d.shown
    ? `${n(d.shown)} shown and ${n(d.completed)} completed from ${dayMonth(d.from, true)} to ${dayMonth(d.to, true)}. The busiest day was ${dayMonth(most.day, true)}, with ${n(most.shown)} shown.`
    : `Nothing shown from ${dayMonth(d.from, true)} to ${dayMonth(d.to, true)}.`;
  return {
    specVersion: "0.3.0",
    surface: { id: "insights-trend", intent: "insights.trend" },
    root: "chart",
    components: [{
      id: "chart", component: "Chart", intent: "trend", title: weekly ? `Each week, the last ${points.length}` : "Each day", summary: { path: "/summary" }, data: { path: "/points" },
      x: { path: "label", label: weekly ? "Week from" : "Day" },
      series: [{ path: "shown", label: "Shown" }, { path: "completed", label: "Completed" }, { path: "abandoned", label: "Abandoned" }],
    }],
    data: { summary, points: rows },
  } as unknown as UIDocument;
}

function Funnel({ f }: { f: Detail["funnel"] }) {
  const top = Math.max(1, f.shown);
  const steps = [
    { label: "Shown", sub: "the screen was on screen", v: f.shown },
    { label: "Started", sub: "completed, or left after doing something", v: f.started },
    { label: "Completed", sub: "the task was done", v: f.completed },
  ];
  return (
    <ol className="ins-funnel">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="ins-funnel-head"><b>{s.label}</b><span className="num">{n(s.v)}{i > 0 && f.shown ? <span className="muted"> · {pct(s.v / f.shown)}</span> : null}</span></div>
          <div className="ins-bar" aria-hidden="true"><i className={i === 2 ? "done" : ""} style={{ width: `${(s.v / top) * 100}%` }} /></div>
          <span className="small muted">{s.sub}</span>
        </li>
      ))}
    </ol>
  );
}

function RankedList({ title, empty, items, label }: { title: string; empty: string; items: Ranked[]; label?: (k: string) => string }) {
  const top = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="card">
      <h2>{title}</h2>
      {items.length ? (
        <ul className="ins-ranked">
          {items.slice(0, 8).map((i) => (
            <li key={i.key}><span className="mono small">{label ? label(i.key) : i.key}</span><span className="ins-bar sm" aria-hidden="true"><i style={{ width: `${(i.count / top) * 100}%` }} /></span><span className="num small">{n(i.count)}</span></li>
          ))}
        </ul>
      ) : <p className="small muted">{empty}</p>}
    </div>
  );
}

function Compare({ d }: { d: Detail }) {
  const gen = d.bySource.find((s) => s.source === "generated");
  const auth = d.bySource.find((s) => s.source === "authored");
  if (!gen || !auth || !gen.shown || !auth.shown) {
    const only = gen?.shown ? "generated" : "authored";
    return (
      <div className="card">
        <h2>Generated and authored</h2>
        <p className="small muted">Only {only} screens sent events for this intent in these {d.days} days. {only === "authored" ? "Name the generator on generated screens (events.generator) and they show here side by side." : "Screens your team authors, sent without a generator, show here beside them."}</p>
      </div>
    );
  }
  const rows: [string, (m: Measures) => ReactNode, (m: Measures) => number | null][] = [
    ["Shown", (m) => n(m.shown), () => null],
    ["Completion", (m) => pct(m.completionRate), (m) => m.completionRate],
    ["Abandoned", (m) => pct(m.shown ? m.abandoned / m.shown : null), (m) => (m.shown ? -m.abandoned / m.shown : null)],
    ["Median time", (m) => m.time?.median ?? "—", () => null],
    ["Mean time", (m) => (m.time ? seconds(m.time.meanMs) : "—"), (m) => (m.time ? -m.time.meanMs : null)],
    ["Input errors per screen", (m) => (m.shown ? (m.inputErrors / m.shown).toFixed(2) : "—"), (m) => (m.shown ? -m.inputErrors / m.shown : null)],
    ["Feedback", (m) => rating(m.feedback), (m) => m.feedback?.average ?? null],
  ];
  return (
    <div className="card">
      <h2>Generated and authored</h2>
      <table className="ins-compare">
        <thead><tr><th></th><th className="r">Generated</th><th className="r">Authored</th></tr></thead>
        <tbody>
          {rows.map(([label, show, better]) => {
            const g = better(gen), a = better(auth);
            const win = g === null || a === null || g === a ? null : g > a ? "g" : "a";
            return <tr key={label}><td>{label}</td><td className={`r num ${win === "g" ? "ins-win" : ""}`}>{show(gen)}</td><td className={`r num ${win === "a" ? "ins-win" : ""}`}>{show(auth)}</td></tr>;
          })}
        </tbody>
      </table>
      <p className="small muted">Better of the two in bold. Small counts swing a lot; read them with the numbers shown.</p>
    </div>
  );
}

export function InsightDetail({ ws }: { ws: Ws }) {
  const { intent = "" } = useParams();
  const { toast } = useSession();
  const [days, setDays] = useRange();
  const [d, setD] = useState<Detail | null>(null);
  const [theme, setTheme] = useState<PreviewTheme | null>(null);
  useEffect(() => {
    api<Detail>("GET", `/api/w/${ws.slug}/insights/${encodeURIComponent(intent)}?days=${days}`).then(setD).catch((e) => toast((e as Error).message, "bad"));
  }, [ws.slug, intent, days]);
  useEffect(() => {
    Promise.all([loadTheme("shadcn"), workspaceTheme(ws.slug).catch(() => null)]).then(([, t]) => setTheme(t ? { base: "shadcn", vars: t.light } : { base: "shadcn" }));
  }, [ws.slug]);
  if (!d) return null;
  const screens = d.screens;
  return (
    <Page
      crumbs={[ws.name, "Product", "Insights", intentLabel(intent)]}
      title={screens.length === 1 ? screens[0].name : intentLabel(intent)}
      lede={screens.length ? undefined : "No screen in Studio has this intent. These are generated screens, or ones your product defines itself."}
      meta={<>
        <span className="tag mono">{intentLabel(intent)}</span>
        {screens.map((s) => <Link key={s.key} className="tag" to={`/w/${ws.slug}/screens/${s.key}`}>Screen: {s.name}</Link>)}
        {d.patterns.map((p) => <span key={p} className="tag">{p}</span>)}
        {d.sources.map((s) => <span key={s} className={`tag ${s === "generated" ? "signal" : ""}`}>{s}</span>)}
      </>}
      actions={<><Link className="btn ghost" to={`/w/${ws.slug}/insights?days=${days}`}>All intents</Link><RangePicker days={days} set={setDays} /></>}
    >
      <div className="grid-4">
        <Stat label="Shown" value={n(d.shown)} sub={`${d.bySurface.length} surface${d.bySurface.length === 1 ? "" : "s"}`} />
        <Stat label="Completion" value={pct(d.completionRate)} sub={`${n(d.completed)} completed · ${n(d.abandoned)} abandoned`} />
        <Stat label="Time to complete" value={d.time?.median ?? "—"} sub={d.time ? `median range · mean ${seconds(d.time.meanMs)}` : "no completions yet"} />
        <Stat label="Feedback" value={rating(d.feedback)} sub={d.feedback ? `from ${n(d.feedback.count)} rating${d.feedback.count === 1 ? "" : "s"}, −1 to +1` : "none sent"} />
      </div>
      <div className="split">
        <div className="card grow ins-chart">
          {theme ? (
            <div data-pxd-theme={theme.base} data-pxd-mode="light" style={(theme.vars ?? {}) as CSSProperties}>
              <Guard fallback={<p className="small muted">Couldn't draw the chart.</p>}>
                <PolyxdSurface document={chartDocument(d)} theme={theme.vars ? undefined : theme.base} mode="light" onAction={() => undefined} />
              </Guard>
            </div>
          ) : <div className="ins-chart-wait" aria-busy="true" />}
          <p className="small muted">Today is counted so far. Drawn by Polyxd's Chart component in your design system, the way your product would draw it.</p>
        </div>
        <div className="aside card">
          <h2>From shown to done</h2>
          <Funnel f={d.funnel} />
          {d.checkpoints > 0 && <p className="small muted">{n(d.checkpoints)} journey checkpoint{d.checkpoints === 1 ? "" : "s"} reached along the way.</p>}
        </div>
      </div>
      <div className="split">
        <div className="card grow">
          <h2>Input errors by component</h2>
          {d.inputErrorsByComponent.length ? (
            <table>
              <thead><tr><th>Component key</th><th className="r">Errors</th><th className="r">Per screen shown</th><th>Reasons</th></tr></thead>
              <tbody>
                {d.inputErrorsByComponent.map((c) => (
                  <tr key={c.component || "-"}>
                    <td className="mono">{c.component || <span className="muted">no key or id</span>}</td>
                    <td className="r num">{n(c.count)}</td>
                    <td className="r num">{d.shown ? (c.count / d.shown).toFixed(2) : "—"}</td>
                    <td><span className="ins-tags">{c.reasons.map((r) => <span key={r.key} className="tag">{r.key} <span className="num muted">{n(r.count)}</span></span>)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="small muted">No input was refused in these {d.days} days.</p>}
        </div>
        <div className="aside"><Compare d={d} /></div>
      </div>
      <div className="grid-3">
        <RankedList title="Actions taken" empty="No actions yet." items={d.actionsByCapability} />
        <RankedList title="Statuses shown" empty="No Status was shown." items={d.statuses} />
        <RankedList title="How people left" empty="Nobody left part way." items={[...d.abandonReasons.map((r) => ({ key: `abandoned · ${r.key}`, count: r.count })), ...d.dismissReasons.map((r) => ({ key: `dismissed · ${r.key}`, count: r.count }))]} />
      </div>
      <p className="small muted ins-foot">Undo used {n(d.undo)} time{d.undo === 1 ? "" : "s"}; asked again (regenerated) {n(d.regenerated)} time{d.regenerated === 1 ? "" : "s"}. {d.byActor.find((a) => a.actor === "agent")?.shown ? `${n(d.byActor.find((a) => a.actor === "agent")!.shown)} of the showings were to agents.` : ""}</p>
    </Page>
  );
}
