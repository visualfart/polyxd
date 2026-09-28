/**
 * The tokens editor: a version's primitives by group, colour ramps as swatches with the contrast
 * each achieves through the roles that use it, scales as lists. Edit a value and every alias that
 * resolves through it follows; the mapping and its contrast pairs are measured again as you type,
 * with the same code the mapping page uses. Save keeps the edits as a new draft version, the way
 * an import does. Rebrand turns a brand ramp's hue (Mono and Blank): one number, the whole ramp.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import contract from "@polyxd/spec/tokens/semantic-contract.json" with { type: "json" };
import { api } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { ExportMenu } from "./Export.tsx";
import { index, resolve, type Graph, type Mode, type Token } from "../../import/read.ts";
import { mapRoles, type Contract, type RoleRow } from "../../import/map.ts";
import { applyChanges, type Change } from "../../tokens/edit.ts";
import { brandHue, oklchRamp, parseOklch, rebrandChanges } from "../../tokens/ramp.ts";
import { display, rgba } from "../../tokens/value.ts";
import "../tokens.css";

const CONTRACT = contract as unknown as Contract;
const CAN_EDIT = new Set(["owner", "design-system", "engineer"]);
const key = (t: { path: string; set: string }) => `${t.set}\u0000${t.path}`;
const isColor = (v: string | null) => !!v && /^(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab|color)\([^()]*\))$/i.test(v.trim());
const hexOf = (v: string | null): string | null => {
  const c = v ? rgba(v) : null;
  return c ? `#${[c[0], c[1], c[2]].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}` : null;
};
/** `mono.palette.brand-600` → group `mono.palette`, family `brand`, step `600`; `space.4` → group `space`, family `space`, step `4`. */
function place(path: string) {
  const parts = path.split(".");
  const group = parts.length > 2 ? parts.slice(0, 2).join(".") : parts.length === 2 ? parts[0] : "(top)";
  const leaf = parts.slice(group === "(top)" ? 0 : group.split(".").length).join(".");
  const m = /^(.*?)[-.]?(\d{1,4})$/.exec(leaf);
  const family = m && m[1] ? m[1] : leaf;
  const step = m && m[1] ? m[2] : "";
  return { group, family, step, leaf };
}
const humanise = (s: string) => s.replace(/[-_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface Loaded {
  name: string;
  number: number;
  status: string;
  template: string | null;
  graph: Graph;
  overrides: { role: string; token: string | null }[];
  extras: boolean;
}
interface Use {
  role: string;
  mode: string;
}

export function TokensEditor({ ws }: { ws: Ws }) {
  const { id, v } = useParams();
  const { toast } = useSession();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT.has(ws.role);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pending, setPending] = useState<Map<string, Change>>(new Map());
  const [modeName, setModeName] = useState<string>("");
  const [group, setGroup] = useState<string>("");
  const [picked, setPicked] = useState<string | null>(null);
  const [rebrand, setRebrand] = useState<{ hue: number; chroma: number } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = `/api/w/${ws.slug}/design-systems/${id}/versions/${v}`;

  useEffect(() => {
    setLoaded(null);
    setPending(new Map());
    setPicked(null);
    api<Loaded>("GET", `${base}/graph`).then((l) => {
      setLoaded(l);
      setModeName(l.graph.modes[0]?.name ?? "");
    }).catch((e) => { toast((e as Error).message, "bad"); navigate(`/w/${ws.slug}/design-systems/${id}`); });
  }, [base]);

  // The working graph: the version's tokens with the pending edits applied.
  const graph = useMemo(() => (loaded ? (pending.size ? applyChanges(loaded.graph, [...pending.values()]) : loaded.graph) : null), [loaded, pending]);
  const mode: Mode | undefined = graph?.modes.find((m) => m.name === modeName) ?? graph?.modes[0];
  const byPath = useMemo(() => (graph ? index(graph) : new Map<string, Token[]>()), [graph]);
  // The mapping, measured again on every change (debounced by React's own batching; the graphs here are small).
  const rows: RoleRow[] = useMemo(() => (graph && loaded ? mapRoles(graph, CONTRACT, loaded.overrides) : []), [graph, loaded]);
  const fails = rows.filter((r) => r.status === "fails");
  // Which roles resolve through each token, in each mode.
  const uses = useMemo(() => {
    const m = new Map<string, Use[]>();
    if (!graph) return m;
    for (const r of rows) {
      if (!r.token) continue;
      for (const md of graph.modes) {
        for (const p of resolve(graph, r.token, md, byPath).chain) m.set(p, [...(m.get(p) ?? []), { role: r.role, mode: md.name }]);
      }
    }
    return m;
  }, [graph, rows, byPath]);
  const byRole = useMemo(() => new Map(rows.map((r) => [r.role, r])), [rows]);

  // The primitives in the current mode: one token per path, the mode's own set winning.
  const shown = useMemo(() => {
    if (!graph || !mode) return [] as Token[];
    const order = mode.sets;
    const best = new Map<string, Token>();
    for (const t of graph.tokens) {
      if (t.tier === "semantic" || !order.includes(t.set)) continue;
      const cur = best.get(t.path);
      if (!cur || order.indexOf(t.set) < order.indexOf(cur.set)) best.set(t.path, t);
    }
    return [...best.values()];
  }, [graph, mode]);
  // Groups: the ramps of literal colours first (a palette), then colour aliases (a pack's own
  // role layer), then the scales, each by size.
  const groups = useMemo(() => {
    const m = new Map<string, { count: number; colours: number; literal: number }>();
    for (const t of shown) {
      const g = place(t.path).group;
      const cur = m.get(g) ?? { count: 0, colours: 0, literal: 0 };
      cur.count++;
      if (isColor(display(resolve(graph!, t.path, mode, byPath).value))) {
        cur.colours++;
        if (!t.alias) cur.literal++;
      }
      m.set(g, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].literal - a[1].literal || b[1].colours - a[1].colours || b[1].count - a[1].count);
  }, [shown, graph, mode, byPath]);
  useEffect(() => {
    if (groups.length && !groups.some(([g]) => g === group)) setGroup(groups[0][0]);
  }, [groups, group]);
  const inGroup = shown.filter((t) => place(t.path).group === group);
  // Swatches for a group of colours of its own; a list for aliases and scales.
  const colourGroup = groups.find(([g]) => g === group)?.[1].literal ?? 0;
  const families = useMemo(() => {
    const m = new Map<string, Token[]>();
    for (const t of inGroup) m.set(place(t.path).family, [...(m.get(place(t.path).family) ?? []), t]);
    for (const list of m.values()) list.sort((a, b) => Number(place(a.path).step || 0) - Number(place(b.path).step || 0));
    return [...m.entries()];
  }, [inGroup]);

  const resolved = (t: Token) => display(resolve(graph!, t.path, mode, byPath).value);
  const setValue = (t: Token, value: unknown) => {
    setPending((p) => {
      const next = new Map(p);
      const original = loaded!.graph.tokens.find((x) => x.path === t.path && x.set === t.set);
      if (original && JSON.stringify(original.value) === JSON.stringify(value)) next.delete(key(t));
      else next.set(key(t), { path: t.path, set: t.set, value });
      return next;
    });
  };
  const applyRebrand = () => {
    if (!rebrand || !graph) return;
    const changes = rebrandChanges(loaded!.graph, rebrand.hue, rebrand.chroma);
    setPending((p) => {
      const next = new Map(p);
      for (const c of changes) next.set(key(c), c);
      return next;
    });
    setRebrand(null);
    toast(`${changes.length} brand steps turned to hue ${Math.round(rebrand.hue)}. Contrast is measured again; save when it reads right.`);
  };
  const save = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      const r = await api<{ versionId: string; number: number; fails: number }>("POST", `${base}/edit`, { changes: [...pending.values()], notes: saving ?? "" });
      toast(`Saved v${r.number}${r.fails ? `; ${r.fails} role${r.fails === 1 ? "" : "s"} fail contrast, so it can't be published yet` : ""}`);
      setSaving(null);
      navigate(`/w/${ws.slug}/design-systems/${id}/versions/${r.versionId}/edit`);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded || !graph || !mode) return null;
  const brand = brandHue(loaded.graph);
  const pickedToken = picked ? shown.find((t) => key(t) === picked) ?? graph.tokens.find((t) => key(t) === picked) ?? null : null;
  const fmt = (n: number) => `${Math.round(n * 10) / 10}:1`;
  return (
    <Page crumbs={[ws.name, "Design systems", loaded.name, `v${loaded.number}`, "Tokens"]} title={loaded.name}
      lede={`v${loaded.number}${loaded.template ? ` · started from the ${humanise(loaded.template)} template` : ""} · ${graph.tokens.length} tokens in ${graph.modes.length} mode${graph.modes.length === 1 ? "" : "s"}. Edit a primitive and every role that resolves through it follows; contrast is measured again as you go.`}
      meta={<>{fails.length ? <span className="tag bad">{fails.length} role{fails.length === 1 ? "" : "s"} fail contrast</span> : <span className="tag ok">Every pair passes contrast</span>}{pending.size ? <span className="tag warn">{pending.size} unsaved change{pending.size === 1 ? "" : "s"}</span> : <span className={`tag ${loaded.status === "live" ? "ok" : "signal"}`}>{loaded.status === "live" ? "Published" : loaded.status}</span>}<span className="small muted">{rows.filter((r) => r.token).length} of {rows.length} roles mapped · <Link to={`/w/${ws.slug}/design-systems/${id}/versions/${v}/map`}>open the mapping</Link></span></>}
      actions={<>
        {brand && canEdit && <button type="button" className="btn" onClick={() => setRebrand(brand)} title="Turn the brand ramp's hue">Rebrand</button>}
        <button type="button" className="btn" onClick={() => setExporting(true)}>Export</button>
        {canEdit && pending.size > 0 && <button type="button" className="btn ghost" onClick={() => setPending(new Map())}>Discard</button>}
        {canEdit && <button type="button" className="btn primary" disabled={!pending.size || busy} onClick={() => setSaving("")} title={pending.size ? `Save the edits as v${loaded.number + 1}` : "Nothing changed yet"}>Save as v{loaded.number + 1}</button>}
      </>}>
      <div className="tok">
        <nav className="side-nav tok-groups" aria-label="Token groups">
          <div className="segmented" role="group" aria-label="Mode" style={{ marginBottom: 8, alignSelf: "flex-start" }}>
            {graph.modes.map((m) => <button key={m.name} type="button" aria-pressed={m.name === mode.name} onClick={() => setModeName(m.name)}>{m.name}</button>)}
          </div>
          {groups.map(([g, n]) => (
            <button type="button" key={g} aria-pressed={g === group} onClick={() => { setGroup(g); setPicked(null); }}>
              <span>{humanise(g.replace(/^[^.]+\./, ""))}<span className="small muted" style={{ display: "block", fontWeight: 400 }}>{g}</span></span>
              <span className="n">{n.count}</span>
            </button>
          ))}
          <div className="small muted" style={{ padding: "12px 10px 0", lineHeight: "16px" }}>The semantic tier ({rows.length} roles) is not edited here: it points at these. Change what a role points at on the mapping page.</div>
        </nav>

        <div className="tok-main">
          {colourGroup > 0 && families.some(([, ts]) => ts.some((t) => isColor(resolved(t)))) ? (
            <div className="tok-ramps">
              {families.map(([family, tokens]) => (
                <div key={family} className="tok-ramp" role="group" aria-label={family}>
                  <div className="tok-ramp-name"><b>{humanise(family)}</b><span className="small muted">{tokens.length} step{tokens.length === 1 ? "" : "s"} · {tokens.reduce((n, t) => n + (uses.get(t.path)?.filter((u) => u.mode === mode.name).length ?? 0), 0)} role reads</span></div>
                  <div className="tok-steps">
                    {tokens.map((t) => {
                      const val = resolved(t);
                      const use = (uses.get(t.path) ?? []).filter((u) => u.mode === mode.name);
                      const outcomes = use.flatMap((u) => contrastOf(byRole, u.role, mode.name));
                      const worst = outcomes.length ? Math.min(...outcomes.map((o) => o.ratio / o.min)) : null;
                      const edited = pending.has(key(t));
                      return (
                        <button type="button" key={key(t)} className="tok-step" aria-pressed={picked === key(t)} data-edited={edited} onClick={() => setPicked(key(t))} title={`${t.path}\n${val ?? "composite"}${use.length ? `\nread by ${use.map((u) => u.role).join(", ")}` : ""}${worst !== null ? `\n${worst >= 1 ? "every pair passes" : "a pair fails contrast"}` : ""}`}>
                          <span className="tok-swatch" style={{ background: isColor(val) ? val! : "transparent" }} aria-hidden="true">{!isColor(val) && <span className="small mono">{val ?? "·"}</span>}</span>
                          <span className="tok-step-label">{place(t.path).step || place(t.path).leaf}{t.alias && <span className="muted" title={`points at ${t.alias}`}> →</span>}</span>
                          <span className="tok-step-meta">{use.length > 0 && <span className={`dot ${worst === null ? "" : worst >= 1 ? "ok" : "bad"}`} title={worst === null ? `${use.length} role${use.length === 1 ? "" : "s"}` : worst >= 1 ? "passes" : "fails"} />}{use.length > 0 && <span className="small muted">{use.length}</span>}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="tok-list">
              <thead><tr><th>Token</th><th>Value</th><th>Read by</th></tr></thead>
              <tbody>
                {inGroup.map((t) => {
                  const val = resolved(t);
                  const use = (uses.get(t.path) ?? []).filter((u) => u.mode === mode.name);
                  return (
                    <tr key={key(t)} className={`row-link ${picked === key(t) ? "selected" : ""}`} onClick={() => setPicked(key(t))} data-edited={pending.has(key(t))}>
                      <td className="mono">{t.path}{t.alias && <span className="small muted"> → {t.alias}</span>}{pending.has(key(t)) && <span className="tag warn" style={{ marginLeft: 8 }}>edited</span>}</td>
                      <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>{isColor(val) && <span className="swatch" style={{ background: val! }} />}<span className="mono small">{val ?? "composite"}</span></span></td>
                      <td className="small muted">{use.length ? [...new Set(use.map((u) => u.role))].join(", ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!inGroup.length && <p className="muted" style={{ padding: 24 }}>Nothing in this group for {mode.name}.</p>}
        </div>

        <aside className="tok-aside" aria-label="Selected token">
          {!pickedToken && <p className="muted">Pick a swatch or a row to edit it and see which roles read it.</p>}
          {pickedToken && (
            <TokenPanel key={key(pickedToken)} token={pickedToken} graph={graph} mode={mode} byPath={byPath} uses={(uses.get(pickedToken.path) ?? [])} byRole={byRole} pending={pending.get(key(pickedToken))} original={loaded.graph.tokens.find((x) => x.path === pickedToken.path && x.set === pickedToken.set)} canEdit={canEdit} onChange={(value) => setValue(pickedToken, value)} onPick={(path) => { const t = shown.find((x) => x.path === path) ?? graph.tokens.find((x) => x.path === path); if (t) { setGroup(place(t.path).group); setPicked(key(t)); } }} fmt={fmt} />
          )}
        </aside>
      </div>

      {rebrand && (
        <>
          <div className="drawer-scrim" onClick={() => setRebrand(null)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label="Rebrand" style={{ width: 560 }}>
            <h2>Rebrand</h2>
            <p className="small" style={{ color: "var(--ink-2)" }}>Turns every step of the brand ramp to one hue, in every mode. Each step keeps its lightness and its chroma (scaled by the second slider), so the ramp's shape is the template's; only the hue is yours. Contrast is measured again rather than assumed: the same lightness lands a shade apart across hues in sRGB. The success, warning and danger ramps keep their hues, because they mean something.</p>
            <div className="tok-preview">{Object.entries(oklchRamp(rebrand.hue, rebrand.chroma)).map(([step, val]) => <span key={step} title={`${step}: ${val}`} style={{ background: val }} />)}</div>
            <div className="field"><label htmlFor="hue">Hue <span className="mono muted">{Math.round(rebrand.hue)}°</span></label><input id="hue" type="range" min={0} max={360} step={1} value={rebrand.hue} onChange={(e) => setRebrand({ ...rebrand, hue: Number(e.target.value) })} className="tok-hue" /></div>
            <div className="field"><label htmlFor="chroma">Chroma <span className="mono muted">×{rebrand.chroma.toFixed(2)}</span></label><input id="chroma" type="range" min={0} max={1.4} step={0.05} value={rebrand.chroma} onChange={(e) => setRebrand({ ...rebrand, chroma: Number(e.target.value) })} /><span className="help">1 is the template's saturation; 0 is grey.</span></div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setRebrand(null)}>Cancel</button><button type="button" className="btn primary" onClick={applyRebrand}>Turn the ramp</button></div>
          </div>
        </>
      )}
      {saving !== null && (
        <>
          <div className="drawer-scrim" onClick={() => setSaving(null)} />
          <form className="dialog" role="dialog" aria-modal="true" aria-label="Save a version" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <h2>Save as v{loaded.number + 1}</h2>
            <p className="small muted">{pending.size} token{pending.size === 1 ? "" : "s"} changed. A new draft version, with the mapping carried over{fails.length ? `; ${fails.length} role${fails.length === 1 ? "" : "s"} fail contrast, so it can be saved but not published yet` : ""}.</p>
            <div className="field"><label htmlFor="notes">What changed</label><input id="notes" className="input" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="Optional, shown in the version list" autoFocus /></div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setSaving(null)}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>Save</button></div>
          </form>
        </>
      )}
      {exporting && <ExportMenu ws={ws} dsId={id!} version={{ id: v!, number: loaded.number, status: loaded.status }} onClose={() => setExporting(false)} />}
    </Page>
  );
}

/** Every contrast reading a role takes part in, in a mode: as the foreground, and as another role's background. */
function contrastOf(byRole: Map<string, RoleRow>, role: string, mode: string): { fg: string; bg: string; ratio: number; min: number; passes: boolean }[] {
  const out: { fg: string; bg: string; ratio: number; min: number; passes: boolean }[] = [];
  const own = byRole.get(role);
  for (const c of own?.contrast ?? []) if (c.mode === mode) out.push({ fg: role, bg: c.against, ratio: c.ratio, min: c.min, passes: c.passes });
  for (const r of byRole.values()) for (const c of r.contrast) if (c.against === role && c.mode === mode) out.push({ fg: r.role, bg: role, ratio: c.ratio, min: c.min, passes: c.passes });
  return out;
}

function TokenPanel({ token, graph, mode, byPath, uses, byRole, pending, original, canEdit, onChange, onPick, fmt }: { token: Token; graph: Graph; mode: Mode; byPath: Map<string, Token[]>; uses: Use[]; byRole: Map<string, RoleRow>; pending?: Change; original?: Token; canEdit: boolean; onChange: (v: unknown) => void; onPick: (path: string) => void; fmt: (n: number) => string }) {
  const r = resolve(graph, token.path, mode, byPath);
  const val = display(r.value);
  const literal = typeof token.value === "string" || typeof token.value === "number";
  const [text, setText] = useState(literal ? String(token.value) : JSON.stringify(token.value, null, 2));
  const [bad, setBad] = useState<string | null>(null);
  const typing = useRef(false);
  useEffect(() => {
    if (!typing.current) setText(literal ? String(token.value) : JSON.stringify(token.value, null, 2));
  }, [token.value, literal]);
  const commit = (s: string) => {
    setText(s);
    if (literal) {
      const n = typeof token.value === "number" && s.trim() !== "" && !Number.isNaN(Number(s)) ? Number(s) : s;
      // A colour that isn't one yet (a half-typed hex) is held back; the rest applies as typed.
      if (typeof token.value === "string" && isColor(token.value) && !isColor(s) && !/^\{.+\}$/.test(s.trim()) && !rgba(s)) return setBad("Not a colour yet: a hex, rgb(), hsl() or oklch() value, or a {reference}.");
      setBad(null);
      onChange(n);
    } else {
      try {
        onChange(JSON.parse(s));
        setBad(null);
      } catch {
        setBad("Not valid JSON yet; the last good value stays.");
      }
    }
  };
  const hex = hexOf(val);
  const modes = graph.modes;
  const perMode = modes.map((m) => ({ m, roles: [...new Set(uses.filter((u) => u.mode === m.name).map((u) => u.role))] }));
  const ok = parseOklch(r.value);
  return (
    <div className="tok-panel">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="tok-big" style={{ background: isColor(val) ? val! : "var(--sunk)" }} aria-hidden="true" />
        <div style={{ minWidth: 0 }}><div className="mono" style={{ fontSize: 14, wordBreak: "break-all" }}>{token.path}</div><div className="small muted">{token.set} · {token.type ?? "untyped"}{pending && " · edited"}</div></div>
      </div>
      <div className="field">
        <label htmlFor="tv">Value{token.alias && <span className="muted"> (a reference)</span>}</label>
        {literal ? (
          <div className="scr-row" style={{ gap: 8 }}>
            {hex && canEdit && <input type="color" value={hex} aria-label="Pick a colour" onChange={(e) => { typing.current = true; commit(e.target.value); typing.current = false; }} className="tok-color" />}
            <input id="tv" className="input mono" value={text} spellCheck={false} disabled={!canEdit} onFocus={() => (typing.current = true)} onBlur={() => (typing.current = false)} onChange={(e) => commit(e.target.value)} />
          </div>
        ) : (
          <textarea id="tv" className="textarea mono" style={{ minHeight: 120, fontSize: 14, lineHeight: "21px" }} value={text} spellCheck={false} disabled={!canEdit} onFocus={() => (typing.current = true)} onBlur={() => (typing.current = false)} onChange={(e) => commit(e.target.value)} />
        )}
        {bad && <span className="err">{bad}</span>}
        {token.alias && <span className="help">Points at <button type="button" className="tok-link" onClick={() => onPick(token.alias!)}>{token.alias}</button>{r.leaf ? <> → <span className="mono">{val}</span>. Edit that to move everything that reads it, or type a value here to cut the link.</> : <span style={{ color: "var(--bad)" }}>, which doesn't exist.</span>}</span>}
        {ok && <span className="help">OKLCH: lightness {Math.round(ok.l * 100)}%, chroma {ok.c}, hue {ok.h}°{hex ? ` · ${hex} in sRGB` : ""}</span>}
        {pending && original && <span className="help">Was <span className="mono">{display(original.value) ?? "composite"}</span>. <button type="button" className="tok-link" onClick={() => onChange(original.value)}>Put it back</button></span>}
      </div>
      <div>
        <b className="small">Read by</b>
        {!uses.length && <p className="small muted" style={{ marginTop: 4 }}>No role resolves through this token in any mode, so nothing on screen changes with it.</p>}
        {perMode.filter((p) => p.roles.length).map(({ m, roles }) => (
          <div key={m.name} style={{ marginTop: 6 }}>
            <div className="small muted" style={{ marginBottom: 4 }}>{m.name}</div>
            {roles.map((role) => {
              const pairs = contrastOf(byRole, role, m.name);
              return (
                <div key={role} className="tok-use">
                  <span className="mono small">{role}</span>
                  {pairs.map((p, i) => (
                    <span key={i} className={`tok-pair ${p.passes ? "ok" : "bad"}`} title={`${p.fg} on ${p.bg} needs ${p.min}:1`}>{fmt(p.ratio)} {p.fg === role ? "on" : "under"} <span className="mono">{p.fg === role ? p.bg.replace(/^color\./, "") : p.fg.replace(/^color\./, "")}</span></span>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
