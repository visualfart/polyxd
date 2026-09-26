import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import { api, type RoleRow, type Scan } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { Chain, Swatch } from "./Mapping.tsx";

interface Version { id: string; number: number; status: string; file_name: string; package_name: string | null; package_version: string | null; created_at: string; published_at: string | null; scan: Scan }
interface DS { id: string; name: string; source: string; is_default: number; versions: Version[] }

export function DesignSystem({ ws }: { ws: Ws }) {
  const { id } = useParams();
  const { toast } = useSession();
  const [ds, setDs] = useState<DS | null>(null);
  const load = () => api<DS>("GET", `/api/w/${ws.slug}/design-systems/${id}`).then(setDs);
  useEffect(() => {
    load();
  }, [ws.slug, id]);
  if (!ds) return null;
  const live = ds.versions.find((v) => v.status === "live");
  const latest = ds.versions[0];
  const shown = live ?? latest;
  const base = `/w/${ws.slug}/design-systems/${ds.id}`;
  const makeDefault = async () => {
    await api("POST", `/api/w/${ws.slug}/design-systems/${ds.id}/default`);
    toast(`${ds.name} is the default`);
    load();
  };
  return (
    <Page crumbs={[ws.name, "Design systems", ds.name]} title={ds.name}
      lede={`${shown.package_name ? `${shown.package_name}@${shown.package_version}` : shown.file_name} · ${shown.scan.total.toLocaleString()} tokens · ${shown.scan.modes.map((m) => m.name).join(", ")}. Changes reach screens only when a version is published.`}
      meta={<>{ds.is_default ? <span className="tag ink">Default</span> : <button type="button" className="btn sm" onClick={makeDefault}>Make default</button>}{live ? <span className="tag ok">v{live.number} live</span> : <span className="tag signal">No live version yet</span>}{latest.status === "draft" && <span className="tag signal">v{latest.number} draft</span>}</>}
      actions={<><Link className="btn" to={`/w/${ws.slug}/design-systems/import`}>Import a new version</Link>{latest.status === "draft" && <Link className="btn primary" to={`${base}/versions/${latest.id}/map`}>Continue mapping</Link>}</>}>
      <nav className="tabs" aria-label="Sections">
        <NavLink to={base} end>Polyxd roles <span className="n">87</span></NavLink>
        <NavLink to={`${base}/tokens`}>Your tokens <span className="n">{shown.scan.total.toLocaleString()}</span></NavLink>
        <NavLink to={`${base}/versions`}>Versions <span className="n">{ds.versions.length}</span></NavLink>
      </nav>
      <Routes>
        <Route index element={<Roles ws={ws} dsId={ds.id} versionId={shown.id} />} />
        <Route path="tokens" element={<Tokens ws={ws} dsId={ds.id} versionId={shown.id} />} />
        <Route path="versions" element={<Versions ds={ds} base={base} />} />
      </Routes>
    </Page>
  );
}

function Roles({ ws, dsId, versionId }: { ws: Ws; dsId: string; versionId: string }) {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [group, setGroup] = useState("color");
  useEffect(() => {
    api<{ rows: RoleRow[]; modes: string[] }>("GET", `/api/w/${ws.slug}/design-systems/${dsId}/versions/${versionId}/mapping`).then((r) => { setRows(r.rows); setModes(r.modes); });
  }, [ws.slug, dsId, versionId]);
  const groups = [...new Set(rows.map((r) => r.role.split(".")[0]))];
  return (
    <div className="split">
      <nav className="side-nav" aria-label="Role groups">
        {groups.map((g) => <button type="button" key={g} aria-pressed={g === group} onClick={() => setGroup(g)}><span style={{ textTransform: "capitalize" }}>{g}</span><span className="n">{rows.filter((r) => r.role.startsWith(g + ".")).length}</span></button>)}
      </nav>
      <div className="grow">
        <table>
          <thead><tr><th>Role</th><th>Your token</th>{modes.map((m) => <th key={m}>{m}</th>)}<th>Contrast</th></tr></thead>
          <tbody>
            {rows.filter((r) => r.role.startsWith(group + ".")).map((r) => (
              <tr key={r.role}>
                <td className="mono">{r.role}</td>
                <td>{r.token ? <Chain chain={r.chain} /> : <span className="muted">—</span>}</td>
                {modes.map((m) => <td key={m}><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Swatch value={r.values[m] ?? null} /><span className="mono small">{r.values[m] ?? "—"}</span></span></td>)}
                <td className="small">{r.contrast.length ? r.contrast.map((c) => <span key={c.against + c.mode} style={{ color: c.passes ? "var(--ok)" : "var(--bad)", marginRight: 8 }}>{c.ratio}</span>) : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Tok { path: string; set: string; tier: string; type: string | null; resolved: string | null; chain: string[]; alias: string | null; usedBy: number; broken: boolean; deprecated: boolean }

function Tokens({ ws, dsId, versionId }: { ws: Ws; dsId: string; versionId: string }) {
  const [q, setQ] = useState("");
  const [prefix, setPrefix] = useState("");
  const [tier, setTier] = useState("");
  const [data, setData] = useState<{ total: number; groups: { group: string; count: number }[]; tokens: Tok[]; modes: string[] } | null>(null);
  const [pick, setPick] = useState<Tok | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api<typeof data>("GET", `/api/w/${ws.slug}/design-systems/${dsId}/versions/${versionId}/tokens?q=${encodeURIComponent(q)}&prefix=${encodeURIComponent(prefix)}&tier=${tier}`).then(setData), 120);
    return () => clearTimeout(t);
  }, [ws.slug, dsId, versionId, q, prefix, tier]);
  if (!data) return null;
  const byTier = new Map<string, { group: string; count: number }[]>();
  for (const g of data.groups) {
    const [t, name] = g.group.split("/");
    byTier.set(t, [...(byTier.get(t) ?? []), { group: name, count: g.count }]);
  }
  return (
    <div className="split">
      <nav className="side-nav" aria-label="Token groups" style={{ width: 240 }}>
        <input className="input" placeholder={`Filter ${data.total.toLocaleString()} tokens`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tokens" style={{ marginBottom: 8 }} />
        {["primitive", "semantic", "component"].map((t) => (
          <div key={t}>
            <button type="button" aria-pressed={tier === t && !prefix} onClick={() => { setTier(tier === t && !prefix ? "" : t); setPrefix(""); }} style={{ textTransform: "capitalize", fontWeight: 600 }}>{t}<span className="n">{(byTier.get(t) ?? []).reduce((a, g) => a + g.count, 0)}</span></button>
            {(byTier.get(t) ?? []).sort((a, b) => b.count - a.count).slice(0, 8).map((g) => (
              <button type="button" key={g.group} aria-pressed={tier === t && prefix === g.group} onClick={() => { setTier(t); setPrefix(prefix === g.group ? "" : g.group); }} style={{ paddingLeft: 24 }}>{g.group}<span className="n">{g.count}</span></button>
            ))}
          </div>
        ))}
      </nav>
      <div className="grow">
        <table>
          <thead><tr><th>Token</th><th>Value ({data.modes[0]})</th><th>Status</th><th style={{ textAlign: "right" }}>Used by</th></tr></thead>
          <tbody>
            {data.tokens.map((t) => (
              <tr key={t.set + t.path} className={`row-link ${pick?.path === t.path && pick.set === t.set ? "selected" : ""}`} onClick={() => setPick(t)}>
                <td className="mono">{t.path}<span className="small muted"> · {t.set}</span></td>
                <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Swatch value={t.resolved} /><span className="mono small">{t.broken ? <span style={{ color: "var(--bad)" }}>Missing</span> : t.resolved ?? "composite"}</span></span></td>
                <td>{t.deprecated ? <span className="tag warn">Deprecated</span> : t.broken ? <span className="tag bad">Broken</span> : <span className="muted">—</span>}</td>
                <td className="num" style={{ textAlign: "right" }}>{t.usedBy || <span className="muted">0</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.tokens.length === 500 && <p className="small muted" style={{ padding: 12 }}>Showing the first 500. Narrow the filter to see the rest.</p>}
      </div>
      {pick && (
        <aside className="aside card" aria-label={pick.path} style={{ background: "var(--sunk)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Swatch value={pick.resolved} /><div><span className="mono" style={{ fontSize: 14 }}>{pick.path}</span><div className="small muted">{pick.tier} · {pick.type ?? "untyped"} · {pick.set}</div></div></div>
          {pick.chain.length > 1 && <div><b className="small">Resolves as</b><div style={{ marginTop: 4 }}><Chain chain={pick.chain} /></div></div>}
          <div className="small muted">Referenced by {pick.usedBy} token{pick.usedBy === 1 ? "" : "s"}. Edit primitives at the source; Studio reads them. Here you choose which of them your roles point at.</div>
        </aside>
      )}
    </div>
  );
}

function Versions({ ds, base }: { ds: DS; base: string }) {
  return (
    <table>
      <thead><tr><th>Version</th><th>Status</th><th>From</th><th>Tokens</th><th>Imported</th><th></th></tr></thead>
      <tbody>
        {ds.versions.map((v) => (
          <tr key={v.id}>
            <td><b>v{v.number}</b></td>
            <td><span className={`tag ${v.status === "live" ? "ok" : v.status === "draft" ? "signal" : ""}`}>{v.status}</span></td>
            <td className="mono small">{v.package_name ? `${v.package_name}@${v.package_version}` : v.file_name}</td>
            <td className="num">{v.scan.total.toLocaleString()}</td>
            <td className="small muted">{new Date(v.created_at).toLocaleString("en-GB")}</td>
            <td style={{ textAlign: "right" }}><Link className="small" to={`${base}/versions/${v.id}/${v.status === "draft" ? "map" : "scan"}`}>{v.status === "draft" ? "Continue mapping" : "Scan"}</Link></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
