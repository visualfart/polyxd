import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api.ts";
import { track } from "../analytics.ts";
import { Page, useSession, type Ws } from "../App.tsx";

interface Comp { name: string; kind: "builtin" | "custom"; category: string; summary: string; whenToUse: string[]; whenNotToUse: string[]; enabled: boolean; renderer: { package: string; export: string } | null; updatedAt: string | null }

export function Components({ ws }: { ws: Ws }) {
  return (
    <ComponentsPanel
      ws={ws}
      frame={(body) => (
        <Page crumbs={[ws.name, "Foundations", "Components"]} title="Components" lede="What generated screens are built from. Use Polyxd's renderer for any of them, connect your own, and tell generators when to use each.">
          {body}
        </Page>
      )}
    />
  );
}

/** Which components generators may use, with guidance and your own renderer: the Components page, and the Direction editor's Components. */
export function ComponentsPanel({ ws, frame }: { ws: Ws; frame: (body: ReactNode) => ReactNode }) {
  const { toast } = useSession();
  const [list, setList] = useState<Comp[]>([]);
  const [open, setOpen] = useState<Comp | null>(null);
  const [draft, setDraft] = useState({ summary: "", whenToUse: "", whenNotToUse: "", pkg: "", exp: "" });
  const load = () => api<{ components: Comp[] }>("GET", `/api/w/${ws.slug}/components`).then((r) => setList(r.components));
  useEffect(() => {
    load();
  }, [ws.slug]);
  const toggle = async (c: Comp) => {
    await api("PUT", `/api/w/${ws.slug}/components/${c.name}`, { enabled: !c.enabled });
    track("components_chosen", { change: c.enabled ? "disabled" : "enabled" }, ws.id);
    toast(`${c.name}: generators ${c.enabled ? "can no longer" : "may now"} use it`);
    load();
  };
  const edit = (c: Comp) => {
    setOpen(c);
    setDraft({ summary: c.summary, whenToUse: c.whenToUse.join("\n"), whenNotToUse: c.whenNotToUse.join("\n"), pkg: c.renderer?.package ?? "", exp: c.renderer?.export ?? "" });
  };
  const save = async () => {
    if (!open) return;
    const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
    await api("PUT", `/api/w/${ws.slug}/components/${open.name}`, {
      guidance: { summary: draft.summary, whenToUse: lines(draft.whenToUse), whenNotToUse: lines(draft.whenNotToUse) },
      renderer: draft.pkg && draft.exp ? { package: draft.pkg, export: draft.exp } : null,
    });
    track("components_chosen", { change: "guidance" }, ws.id);
    toast(`Saved ${open.name}`);
    setOpen(null);
    load();
  };
  const groups = [...new Set(list.map((c) => c.category))];
  return frame(
    <>
      <table>
        <thead><tr><th>Component</th><th>Rendered with</th><th>Generators may use it</th><th></th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <GroupRows key={g} name={g} items={list.filter((c) => c.category === g)} onToggle={toggle} onEdit={edit} />
          ))}
        </tbody>
      </table>
      {open && (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(null)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label={open.name}>
            <header><h2>{open.name}</h2><button type="button" className="btn ghost sm" onClick={() => setOpen(null)}>Close</button></header>
            <div className="body">
              <div className="field"><label htmlFor="sum">What it is</label><input id="sum" className="input" value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></div>
              <div className="field"><label htmlFor="use">When to use it <span className="muted">(one per line)</span></label><textarea id="use" className="textarea" value={draft.whenToUse} onChange={(e) => setDraft({ ...draft, whenToUse: e.target.value })} /><span className="help">Generators read this. Changes go out with the next release.</span></div>
              <div className="field"><label htmlFor="not">Not for</label><textarea id="not" className="textarea" value={draft.whenNotToUse} onChange={(e) => setDraft({ ...draft, whenNotToUse: e.target.value })} /></div>
              <h2>Rendered with</h2>
              <p className="small muted">Leave both empty to use Polyxd's renderer. To use your own component, name the package and export; the verifier then checks what you ship.</p>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: 1 }}><label htmlFor="pkg">Package</label><input id="pkg" className="input mono" placeholder="@acme/ui" value={draft.pkg} onChange={(e) => setDraft({ ...draft, pkg: e.target.value })} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="exp">Export</label><input id="exp" className="input mono" placeholder="Select" value={draft.exp} onChange={(e) => setDraft({ ...draft, exp: e.target.value })} /></div>
              </div>
            </div>
            <footer><button type="button" className="btn" onClick={() => setOpen(null)}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save</button></footer>
          </div>
        </>
      )}
    </>,
  );
}

function GroupRows({ name, items, onToggle, onEdit }: { name: string; items: Comp[]; onToggle: (c: Comp) => void; onEdit: (c: Comp) => void }) {
  return (
    <>
      <tr><th colSpan={4} scope="colgroup" style={{ textTransform: "uppercase", letterSpacing: "0.04em", paddingTop: 16, borderBottom: 0, height: "auto", paddingBottom: 6 }}>{name}</th></tr>
      {items.map((c) => (
        <tr key={c.name}>
          <td><b>{c.name}</b><div className="small muted">{c.summary}</div></td>
          <td>{c.renderer ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><span className="dot ok" /><span className="mono small">{c.renderer.package} · {c.renderer.export}</span></span> : <span className="muted">Polyxd's renderer</span>}</td>
          <td><button type="button" role="switch" aria-checked={c.enabled} aria-label={`Allow generators to use ${c.name}`} className="switch" onClick={() => onToggle(c)}><i /></button></td>
          <td style={{ textAlign: "right" }}><button type="button" className="btn ghost sm" onClick={() => onEdit(c)}>Edit</button></td>
        </tr>
      ))}
    </>
  );
}
