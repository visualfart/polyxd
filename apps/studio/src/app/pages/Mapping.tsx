import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Candidate, type RoleRow } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";

interface MappingData { modes: string[]; rows: RoleRow[]; summary: { total: number; mapped: number; exact: number; guessed: number; missing: number; fails: number; primitive: number; off: number } }

const STATUS: Record<RoleRow["status"], [string, string]> = {
  exact: ["ok", "Exact"], guessed: ["info", "Guessed"], missing: ["warn", "Missing"], fails: ["bad", "Fails contrast"], primitive: ["warn", "Primitive"], off: ["", "Unmapped on purpose"],
};
const isColor = (v: string | null) => !!v && /^(#|rgb|hsl|oklch)/i.test(v);

export function Swatch({ value }: { value: string | null }) {
  return isColor(value) ? <span className="swatch" style={{ background: value! }} aria-hidden="true" /> : null;
}

export function Chain({ chain }: { chain: string[] }) {
  return (
    <span className="chain">
      {chain.map((p, i) => (
        <span key={p}>{i > 0 && <span className="arrow" aria-hidden="true">→ </span>}<span style={{ color: i === 0 ? "var(--ink)" : "var(--ink-2)" }}>{p}</span></span>
      ))}
    </span>
  );
}

export function Mapping({ ws }: { ws: Ws }) {
  const { id, v } = useParams();
  const { toast } = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState<MappingData | null>(null);
  const [group, setGroup] = useState("color");
  const [filter, setFilter] = useState<"look" | "all">("look");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [candQ, setCandQ] = useState("");
  const [name, setName] = useState("");
  const base = `/api/w/${ws.slug}/design-systems/${id}/versions/${v}`;
  const load = () => api<MappingData>("GET", `${base}/mapping`).then(setData);
  useEffect(() => {
    load();
    api<{ name: string }>("GET", `/api/w/${ws.slug}/design-systems/${id}`).then((d) => setName(d.name));
  }, [base]);
  useEffect(() => {
    if (!selected) return;
    const t = setTimeout(() => api<{ candidates: Candidate[] }>("GET", `${base}/candidates?role=${encodeURIComponent(selected)}&q=${encodeURIComponent(candQ)}`).then((r) => setCands(r.candidates)), 150);
    return () => clearTimeout(t);
  }, [selected, candQ, base]);

  const groups = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const r of data?.rows ?? []) {
      const g = r.role.split(".")[0];
      const cur = m.get(g) ?? { done: 0, total: 0 };
      cur.total++;
      if (r.status === "exact" || r.status === "off") cur.done++;
      m.set(g, cur);
    }
    return [...m.entries()];
  }, [data]);
  const rows = (data?.rows ?? []).filter((r) => r.role.startsWith(group + ".") && (filter === "all" || (r.status !== "exact" && r.status !== "off")) && (!q || r.role.includes(q) || (r.token ?? "").includes(q)));
  const row = data?.rows.find((r) => r.role === selected) ?? null;

  const set = async (role: string, token: string | null, reset = false) => {
    try {
      await api("PUT", `${base}/mapping`, { role, token, reset });
      await load();
      toast(reset ? `${role}: back to Studio's guess` : token ? `${role} reads ${token}` : `${role} left unmapped`);
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const acceptExact = async () => {
    const r = await api<{ accepted: number }>("POST", `${base}/accept-exact`);
    toast(`Accepted ${r.accepted} exact matches`);
    load();
  };
  const publish = async () => {
    try {
      await api("POST", `${base}/publish`);
      toast("Published. Screens in this workspace draw with it now.");
      navigate(`/w/${ws.slug}/design-systems/${id}`);
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  if (!data) return null;
  const s = data.summary;
  return (
    <Page crumbs={[ws.name, "Design systems", name, "Map"]} title="Map to Polyxd's roles" lede="Your semantic tokens were matched to Polyxd's roles by name, type and value. Accept the exact ones in one go and look only at the rest."
      meta={<span className="small" style={{ color: "var(--ink-2)" }}><b>{s.mapped} of {s.total}</b> mapped · {s.exact} exact · {s.guessed} guessed · {s.missing} missing · {s.fails} fail contrast · {s.primitive} point at primitives · {s.off} unmapped on purpose</span>}
      actions={<><Link className="btn" to={`/w/${ws.slug}/design-systems/${id}`}>Save draft</Link><button type="button" className="btn primary" onClick={publish}>Publish</button></>}>
      <div className="split" style={{ borderTop: "1px solid var(--line)", paddingTop: 16, margin: "0 -32px", paddingLeft: 24, paddingRight: 0 }}>
        <nav className="side-nav" aria-label="Role groups">
          {groups.map(([g, n]) => (
            <button type="button" key={g} aria-pressed={g === group} onClick={() => setGroup(g)}>
              <span style={{ textTransform: "capitalize" }}>{g}</span><span className="n">{n.done} of {n.total}</span>
            </button>
          ))}
        </nav>
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 12, paddingRight: 20 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input className="input" style={{ width: 220 }} placeholder="Search roles or tokens" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search roles or tokens" />
            <button type="button" className="chip" aria-pressed={filter === "look"} onClick={() => setFilter(filter === "look" ? "all" : "look")}>Needs a look <span className="num">{s.guessed + s.missing + s.fails + s.primitive}</span></button>
            <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={acceptExact} disabled={!data.rows.some((r) => r.how === "named" && r.status === "exact")}>Accept {data.rows.filter((r) => r.how === "named" && r.status === "exact").length} exact</button>
          </div>
          <table>
            <thead><tr><th>Polyxd role</th><th>Your token</th><th>{data.modes.join(" · ")}</th><th>Match</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.role} className={`row-link ${r.role === selected ? "selected" : ""}`} onClick={() => { setSelected(r.role); setCandQ(""); }}>
                  <td className="mono">{r.role}</td>
                  <td>{r.token ? <div style={{ display: "flex", flexDirection: "column" }}><span className="mono">{r.token}</span>{r.chain.length > 1 && <span className="mono small muted">→ {r.chain[r.chain.length - 1]}</span>}</div> : <span className="muted">—</span>}</td>
                  <td><span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>{data.modes.map((m) => <Swatch key={m} value={r.values[m] ?? null} />)}{!isColor(r.values[data.modes[0]] ?? null) && r.values[data.modes[0]] && <span className="mono small">{r.values[data.modes[0]]}</span>}</span></td>
                  <td><span className={`tag ${STATUS[r.status][0]}`}>{STATUS[r.status][1]}</span></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="muted" style={{ padding: 24, textAlign: "center" }}>Nothing here needs a look.</td></tr>}
            </tbody>
          </table>
        </div>
        <aside className="aside" aria-label="Selected role" style={{ borderLeft: "1px solid var(--line)", padding: "4px 24px 0", minHeight: 480, display: "flex", flexDirection: "column", gap: 14, background: "var(--sunk)", marginTop: -16, paddingTop: 20 }}>
          {!row && <p className="muted">Pick a role to see what it reads, and what else it could.</p>}
          {row && (
            <>
              <div><span className="mono" style={{ fontSize: 14 }}>{row.role}</span><p className="small muted" style={{ marginTop: 6 }}>{row.description}</p></div>
              <div><b className="small">Now</b>
                <div className="card" style={{ padding: "10px 12px", gap: 6, marginTop: 6 }}>
                  {row.token ? <Chain chain={row.chain} /> : <span className="muted small">Nothing. {row.why}</span>}
                  {row.token && <span className="small muted">{row.why}</span>}
                  {row.contrast.map((c) => <span key={c.against + c.mode} className="small" style={{ color: c.passes ? "var(--ok)" : "var(--bad)" }}>{c.ratio}:1 on {c.against} in {c.mode} · needs {c.min}:1</span>)}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <b className="small">Point it at another token</b>
                <input className="input mono" placeholder="Search your tokens" value={candQ} onChange={(e) => setCandQ(e.target.value)} aria-label="Search your tokens" />
                {cands.map((c) => (
                  <button type="button" key={c.token} className="choice-card" style={{ textAlign: "left", width: "100%", alignItems: "center" }} onClick={() => set(row.role, c.token)}>
                    <Swatch value={c.value} />
                    <span style={{ flexGrow: 1, minWidth: 0 }}><b className="mono" style={{ fontWeight: 500, fontSize: 13 }}>{c.token}</b><span>{c.chain.length > 1 ? `→ ${c.chain[c.chain.length - 1]} · ` : ""}{c.tier}{c.contrast[0] ? ` · ${c.contrast[0].ratio}:1` : ""}</span></span>
                    {c.contrast[0] && <span className={`tag ${c.contrast[0].passes ? "ok" : "bad"}`}>{c.contrast[0].passes ? "passes" : "fails"}</span>}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingBottom: 16 }}>
                {row.token && row.how !== "manual" && <button type="button" className="btn primary" onClick={() => set(row.role, row.token)}>Accept</button>}
                {row.how === "manual" && <button type="button" className="btn" onClick={() => set(row.role, null, true)}>Back to the guess</button>}
                {row.status !== "off" && <button type="button" className="btn ghost" onClick={() => set(row.role, null)}>Leave unmapped</button>}
              </div>
            </>
          )}
        </aside>
      </div>
    </Page>
  );
}
