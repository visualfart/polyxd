import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Scan, type TemplateSummary } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { Mark } from "../mark.tsx";
import "../tokens.css";

interface DS { id: string; name: string; source: string; is_default: number; versions: number; status: string | null; scan: Scan | null; latest_version_id: string | null; created_at: string }

const SOURCE: Record<string, string> = { package: "npm package", "tokens-studio": "Tokens Studio", dtcg: "Design tokens (DTCG)", css: "CSS variables", tarball: "Uploaded package", template: "From a template" };
const CAN_EDIT = new Set(["owner", "design-system", "engineer"]);

export function DesignSystems({ ws }: { ws: Ws }) {
  const [list, setList] = useState<DS[] | null>(null);
  const [deleting, setDeleting] = useState<DS | null>(null);
  const [confirm, setConfirm] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [template, setTemplate] = useState("mono");
  const [tplName, setTplName] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useSession();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT.has(ws.role);
  const openChooser = () => {
    setChoosing(true);
    if (!templates) api<{ templates: TemplateSummary[] }>("GET", "/api/design-system-templates").then((r) => setTemplates(r.templates)).catch((e) => toast((e as Error).message, "bad"));
  };
  const start = async () => {
    setBusy(true);
    try {
      const r = await api<{ designSystemId: string; versionId: string; mapped: number; fails: number; scan: Scan }>("POST", `/api/w/${ws.slug}/design-systems/from-template`, { template, name: tplName.trim() || undefined });
      toast(`${r.scan.total} tokens scanned, ${r.mapped} of 87 roles mapped${r.fails ? `, ${r.fails} fail contrast` : ", every pair passes contrast"}. Tune it, then publish.`);
      setChoosing(false);
      navigate(`/w/${ws.slug}/design-systems/${r.designSystemId}/versions/${r.versionId}/edit`);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const load = () => api<{ designSystems: DS[] }>("GET", `/api/w/${ws.slug}/design-systems`).then((r) => setList(r.designSystems));
  useEffect(() => {
    load();
  }, [ws.slug]);
  const remove = async () => {
    if (!deleting) return;
    try {
      await api("DELETE", `/api/w/${ws.slug}/design-systems/${deleting.id}`, { confirm });
      toast(`Deleted ${deleting.name}`);
      setDeleting(null);
      setConfirm("");
      load();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  return (
    <Page crumbs={[ws.name, "Foundations", "Design systems"]} title="Design systems" lede="The token sets your screens are drawn in. Each maps your tokens onto Polyxd's 87 roles and is checked for contrast in every mode. Bring yours, or start from a template and make it yours." actions={<>{canEdit && <button type="button" className="btn" onClick={openChooser}>Start from a template</button>}<Link className="btn primary" to={`/w/${ws.slug}/design-systems/import`}>Import</Link></>}>
      {list && !list.length && (
        <div className="empty">
          <h2>No design system yet</h2>
          <p>Import your tokens from an npm package, a Tokens Studio or DTCG file, or your CSS: Studio maps them onto Polyxd's roles and shows every guess before anything is used. Or start from one of twelve templates, tune it, and export it for your code.</p>
          <div style={{ display: "flex", gap: 8 }}>{canEdit && <button type="button" className="btn" onClick={openChooser}>Start from a template</button>}<Link className="btn" to={`/w/${ws.slug}/design-systems/import`}>Import a design system</Link></div>
        </div>
      )}
      {!!list?.length && (
        <div className="grid-3">
          {list.map((d) => (
            <div className="card" key={d.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/w/${ws.slug}/design-systems/${d.id}`)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="tag">{SOURCE[d.source] ?? d.source}</span>
                {d.is_default ? <span className="tag ink">Default</span> : d.status === "draft" ? <span className="tag signal">Draft</span> : <span className="tag ok">Live</span>}
              </div>
              <div><h2>{d.name}</h2><p className="small muted">{d.versions} version{d.versions === 1 ? "" : "s"} · imported {new Date(d.created_at).toLocaleDateString("en-GB")}</p></div>
              {d.scan && (
                <div className="small muted">
                  <div>{d.scan.total.toLocaleString()} tokens · {d.scan.modes.map((m) => m.name).join(", ")}</div>
                  <div>{d.scan.byTier.primitive} primitive · {d.scan.byTier.semantic} semantic · {d.scan.byTier.component} component</div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--soft)", paddingTop: 12 }}>
                <span style={{ display: "flex", gap: 12 }}><Link to={`/w/${ws.slug}/design-systems/${d.id}/versions/${d.latest_version_id}/map`} onClick={(e) => e.stopPropagation()} className="small">Mapping</Link><Link to={`/w/${ws.slug}/design-systems/${d.id}/versions/${d.latest_version_id}/edit`} onClick={(e) => e.stopPropagation()} className="small">Tokens</Link></span>
                <button type="button" className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setDeleting(d); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {choosing && (
        <>
          <div className="drawer-scrim" onClick={() => setChoosing(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Start from a template" style={{ width: 720 }}>
            <header><div style={{ flexGrow: 1 }}><h2>Start from a template</h2><p className="small muted" style={{ marginTop: 4 }}>Twelve original designs and a blank. The one you pick becomes a design system of this workspace, its tokens copied and every role mapped; edit anything, then export it for your code.</p></div><button type="button" className="btn ghost sm" onClick={() => setChoosing(false)}>Close</button></header>
            <div className="body">
              {!templates && <p className="muted small" style={{ display: "flex", alignItems: "center", gap: 8 }}><Mark size={24} state="thinking" />Loading the templates…</p>}
              {templates && (
                <div className="tpl-grid" role="listbox" aria-label="Templates">
                  {templates.map((t) => (
                    <button type="button" key={t.name} role="option" aria-selected={template === t.name} aria-pressed={template === t.name} className="tpl" onClick={() => setTemplate(t.name)}>
                      <span className="tpl-strip" aria-hidden="true">{t.swatches.map((s) => <span key={s.role} title={`${s.role}: ${s.value}`} style={{ background: s.value }} />)}</span>
                      <span><b>{t.displayName}</b><span className="character">{t.character}</span></span>
                      <span className="facts">{t.radius ? `radius ${t.radius}` : ""}{t.font ? ` · ${t.font}` : ""} · {t.modes.join(", ")}{t.extras ? " · extras.css" : ""}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="field"><label htmlFor="tplname">Name it <span className="muted">(optional)</span></label><input id="tplname" className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={templates?.find((t) => t.name === template)?.displayName ?? "The template's name"} /><span className="help">The theme, file and enum names in every export come from it.</span></div>
            </div>
            <footer><button type="button" className="btn" onClick={() => setChoosing(false)}>Cancel</button><button type="button" className="btn primary" onClick={start} disabled={busy || !templates}>{busy ? "Copying…" : "Create design system"}</button></footer>
          </div>
        </>
      )}
      {deleting && (
        <>
          <div className="drawer-scrim" onClick={() => setDeleting(null)} />
          <div className="dialog" role="dialog" aria-modal="true" aria-label={`Delete ${deleting.name}?`}>
            <h2>Delete {deleting.name}?</h2>
            <p style={{ color: "var(--ink-2)" }}>Its {deleting.versions} version{deleting.versions === 1 ? "" : "s"} and every mapping go with it. {deleting.is_default ? "It is the default, so screens fall back to Polyxd's own tokens until you pick another." : ""}</p>
            <div className="field"><label htmlFor="confirm">Type {deleting.name} to confirm</label><input id="confirm" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setDeleting(null)}>Cancel</button>
              <button type="button" className="btn danger" disabled={confirm !== deleting.name} onClick={remove}>Delete design system</button>
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
