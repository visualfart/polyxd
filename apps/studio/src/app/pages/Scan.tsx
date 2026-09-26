import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Scan } from "../api.ts";
import { Page, type Ws } from "../App.tsx";

interface DS { id: string; name: string; versions: { id: string; number: number; status: string; file_name: string; package_name: string | null; package_version: string | null; scan: Scan }[] }

const ISSUE: Record<string, [string, string]> = {
  "broken-alias": ["bad", "Broken references"],
  "circular-alias": ["bad", "Circular aliases"],
  deprecated: ["warn", "Deprecated tokens"],
  "unsupported-type": ["", "Types Polyxd doesn't use"],
};

export function ScanPage({ ws }: { ws: Ws }) {
  const { id, v } = useParams();
  const [ds, setDs] = useState<DS | null>(null);
  useEffect(() => {
    api<DS>("GET", `/api/w/${ws.slug}/design-systems/${id}`).then(setDs);
  }, [ws.slug, id]);
  const ver = ds?.versions.find((x) => x.id === v);
  if (!ds || !ver) return null;
  const s = ver.scan;
  return (
    <Page crumbs={[ws.name, "Design systems", ds.name, "Scan"]} title={`We found ${s.total.toLocaleString()} tokens`} lede={`${ver.package_name ? `${ver.package_name}@${ver.package_version}` : ver.file_name} · ${s.sets.length} set${s.sets.length === 1 ? "" : "s"}. Here's what's in it before anything is mapped.`}
      actions={<><Link className="btn ghost" to={`/w/${ws.slug}/design-systems/import`}>Back</Link><Link className="btn primary" to={`/w/${ws.slug}/design-systems/${ds.id}/versions/${ver.id}/map`}>Map to Polyxd roles</Link></>}>
      <div className="split">
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="grid-3">
            {([["Primitives", s.byTier.primitive, "Raw values: brand/600, space/4, font/size/16"], ["Semantic", s.byTier.semantic, "What things mean: action/primary, text/subtle"], ["Component", s.byTier.component, "Per component: button/primary/bg, input/border"]] as const).map(([t, n, d]) => (
              <div className="card stat" key={t}><span className="small muted">{t}</span><span className="v num">{n.toLocaleString()}</span><span className="small" style={{ color: "var(--ink-2)" }}>{d}</span></div>
            ))}
          </div>
          <div className="card" style={{ gap: 8 }}>
            <h2>By type and tier</h2>
            <table>
              <thead><tr><th>Type</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Primitive</th><th style={{ textAlign: "right" }}>Semantic</th><th style={{ textAlign: "right" }}>Component</th></tr></thead>
              <tbody>
                {s.byType.map((r) => (
                  <tr key={r.type}><td>{r.label}</td><td className="num" style={{ textAlign: "right" }}>{r.total.toLocaleString()}</td><td className="num" style={{ textAlign: "right" }}>{r.primitive.toLocaleString()}</td><td className="num" style={{ textAlign: "right" }}>{r.semantic.toLocaleString()}</td><td className="num" style={{ textAlign: "right" }}>{r.component.toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.picked && s.picked.length > 1 && (
            <div className="notice gray"><div className="body"><b>Read {s.picked[0]}</b>Other token files in the package: {s.picked.slice(1).join(", ")}. Import one of them separately if it is a different design system.</div></div>
          )}
        </div>
        <div className="aside" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card" style={{ gap: 6 }}>
            <h2>Modes</h2>
            <p>What each becomes in Polyxd.</p>
            <ul className="list">
              {s.modes.map((m) => (
                <li key={m.name}><div style={{ flexGrow: 1 }}><div style={{ fontWeight: 500 }}>{m.name}</div><div className="small muted">{m.sets.join(", ")}</div></div><span className="tag">{/dark/i.test(m.name) ? "Dark mode" : /contrast|hc/i.test(m.name) ? "High contrast" : /compact|comfortable|dense/i.test(m.name) ? "Density" : "Light mode"}</span></li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ gap: 6 }}>
            <h2>To look at</h2>
            <p>None of these stop the import.</p>
            {!s.issues.length && <p className="small muted" style={{ paddingTop: 8 }}>Every reference resolves and nothing is deprecated.</p>}
            <ul className="list">
              {s.issues.map((i) => (
                <li key={i.kind} style={{ alignItems: "flex-start" }}>
                  <span className={`dot ${ISSUE[i.kind]?.[0] ?? ""}`} style={{ marginTop: 6 }} />
                  <div><div style={{ fontWeight: 500 }}>{i.count} {(ISSUE[i.kind]?.[1] ?? i.kind).toLowerCase()}</div><div className="small muted">{i.examples[0]}</div></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Page>
  );
}
