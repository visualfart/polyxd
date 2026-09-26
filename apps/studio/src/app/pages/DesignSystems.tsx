import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type Scan } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";

interface DS { id: string; name: string; source: string; is_default: number; versions: number; status: string | null; scan: Scan | null; latest_version_id: string | null; created_at: string }

const SOURCE: Record<string, string> = { package: "npm package", "tokens-studio": "Tokens Studio", dtcg: "Design tokens (DTCG)", css: "CSS variables", tarball: "Uploaded package" };

export function DesignSystems({ ws }: { ws: Ws }) {
  const [list, setList] = useState<DS[] | null>(null);
  const [deleting, setDeleting] = useState<DS | null>(null);
  const [confirm, setConfirm] = useState("");
  const { toast } = useSession();
  const navigate = useNavigate();
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
    <Page crumbs={[ws.name, "Foundations", "Design systems"]} title="Design systems" lede="The token sets your screens are drawn in. Each maps your tokens onto Polyxd's 87 roles and is checked for contrast in every mode." actions={<Link className="btn primary" to={`/w/${ws.slug}/design-systems/import`}>Import</Link>}>
      {list && !list.length && (
        <div className="empty">
          <h2>No design system yet</h2>
          <p>Import your tokens from an npm package, a Tokens Studio or DTCG file, or your CSS. Studio maps them onto Polyxd's roles and shows every guess before anything is used.</p>
          <Link className="btn primary" to={`/w/${ws.slug}/design-systems/import`}>Import a design system</Link>
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
                <Link to={`/w/${ws.slug}/design-systems/${d.id}/versions/${d.latest_version_id}/map`} onClick={(e) => e.stopPropagation()} className="small">Open mapping</Link>
                <button type="button" className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setDeleting(d); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
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
