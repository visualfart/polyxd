import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, type ScreenRow } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { SHELL_TEMPLATE, TEMPLATES, fromTemplate, shellFromTemplate } from "../screen/templates.ts";
import { checkDocument } from "../../screens/validate.ts";

const CAN_EDIT = new Set(["owner", "design-system", "designer", "product"]);
const slugOf = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function Screens({ ws }: { ws: Ws }) {
  const { toast } = useSession();
  const navigate = useNavigate();
  const [list, setList] = useState<ScreenRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [intent, setIntent] = useState("");
  const [start, setStart] = useState<"blank" | "template" | "shell" | "paste">("template");
  const [template, setTemplate] = useState(TEMPLATES.find((t) => t.id === "money-send-form")?.id ?? TEMPLATES[0]?.id ?? "");
  const [pasted, setPasted] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const canEdit = CAN_EDIT.has(ws.role);
  const load = () => api<{ screens: ScreenRow[] }>("GET", `/api/w/${ws.slug}/screens`).then((r) => setList(r.screens));
  useEffect(() => {
    load();
  }, [ws.slug]);

  const pastedCheck = useMemo(() => {
    if (start !== "paste" || !pasted.trim()) return null;
    try {
      const doc = JSON.parse(pasted);
      const r = checkDocument(doc);
      return { doc, errors: r.issues.filter((i) => i.severity === "error").length, warnings: r.issues.filter((i) => i.severity === "warning").length, title: doc?.surface?.title as string | undefined, intent: doc?.surface?.intent as string | undefined };
    } catch {
      return { doc: null, errors: 0, warnings: 0 };
    }
  }, [start, pasted]);

  const open = () => {
    setCreating(true);
    setName("");
    setKey("");
    setKeyEdited(false);
    setIntent("");
    setPasted("");
  };
  const pickTemplate = (id: string) => {
    setTemplate(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t && !name) setIntent(t.intent);
  };
  const create = async () => {
    const t = TEMPLATES.find((x) => x.id === template);
    const title = name.trim() || (start === "template" ? t?.title : start === "shell" ? "Shell" : pastedCheck?.title) || "";
    const finalIntent = start === "shell" ? "product.shell" : intent.trim() || (start === "template" ? t?.intent : pastedCheck?.intent) || "";
    let document: unknown;
    if (start === "template" && t) document = fromTemplate(t, title, finalIntent);
    if (start === "shell") document = shellFromTemplate(name.trim() || "Your product");
    if (start === "paste") {
      if (!pastedCheck?.doc) return toast("Paste a document first", "bad");
      document = { ...pastedCheck.doc, surface: { ...pastedCheck.doc.surface, title: title || pastedCheck.doc.surface?.title, origin: "authored" } };
    }
    setBusy(true);
    try {
      const r = await api<{ key: string }>("POST", `/api/w/${ws.slug}/screens`, { name: title, key: key || slugOf(title), intent: finalIntent, document });
      setCreating(false);
      navigate(`/w/${ws.slug}/screens/${r.key}`);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (s: ScreenRow) => {
    if (!window.confirm(`Delete “${s.name}” and all ${s.versions} version${s.versions === 1 ? "" : "s"}? A product fetching it by key will get a 404.`)) return;
    await api("DELETE", `/api/w/${ws.slug}/screens/${s.key}`);
    toast(`Deleted “${s.name}”`);
    load();
  };

  if (!list) return null;
  const shown = TEMPLATES.filter((t) => !q || `${t.title} ${t.intent} ${t.shape}`.toLowerCase().includes(q.toLowerCase()));
  const selectedTemplate = TEMPLATES.find((t) => t.id === template);
  return (
    <Page crumbs={[ws.name, "Product", "Screens"]} title="Screens" lede="Surfaces designed here rather than generated, and the shell they sit in: written as Polyxd documents, drawn in your design system, checked like any generated screen, and fetched by your product by key." actions={canEdit && <button type="button" className="btn primary" onClick={open}>New screen</button>}>
      {!list.length && (
        <div className="empty" style={{ maxWidth: 560 }}>
          <h2>No screens yet</h2>
          <p>A screen is a Polyxd document a person wrote: the same components, bindings and checks as a generated one, but designed on purpose. Start from one of the spec's examples and make it yours.</p>
          {canEdit && <button type="button" className="btn" onClick={open}>New screen</button>}
        </div>
      )}
      {!!list.length && (
        <table>
          <thead><tr><th>Screen</th><th>Key</th><th>Intent</th><th>Status</th><th>Checks</th><th>Versions</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="row-link" onClick={() => navigate(`/w/${ws.slug}/screens/${s.key}`)}>
                <td><b>{s.name}</b>{s.kind === "shell" && <span className="tag" style={{ marginLeft: 8 }}>shell</span>}</td>
                <td className="mono small">{s.key}</td>
                <td className="mono small">{s.intent || <span className="muted">—</span>}</td>
                <td>{s.status === "published" ? <span className="tag ok">v{s.published} published</span> : <span className="tag signal">draft</span>}</td>
                <td>{s.errors ? <span className="tag bad">{s.errors} error{s.errors === 1 ? "" : "s"}</span> : s.warnings ? <span className="tag warn">{s.warnings} warning{s.warnings === 1 ? "" : "s"}</span> : <span className="tag ok">Checked</span>}</td>
                <td className="num">{s.versions}</td>
                <td className="small muted">{when(s.updated_at)}</td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <Link className="btn ghost sm" to={`/w/${ws.slug}/screens/${s.key}`}>Open</Link>
                  {canEdit && <button type="button" className="btn ghost sm" onClick={() => remove(s)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {creating && (
        <>
          <div className="drawer-scrim" onClick={() => setCreating(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="New screen" style={{ width: 620 }}>
            <header><h2>New screen</h2><button type="button" className="btn ghost sm" onClick={() => setCreating(false)}>Close</button></header>
            <div className="body">
              <div className="segmented" role="tablist" aria-label="Start from">
                {(["template", "shell", "blank", "paste"] as const).map((s) => <button key={s} type="button" role="tab" aria-pressed={start === s} onClick={() => setStart(s)}>{s === "template" ? "An example" : s === "shell" ? "Shell" : s === "blank" ? "Blank" : "Paste JSON"}</button>)}
              </div>
              {start === "template" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input className="input" placeholder={`Search ${TEMPLATES.length} examples`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search examples" />
                  <div className="scr-templates" role="listbox" aria-label="Examples">
                    {shown.map((t) => (
                      <button type="button" key={t.id} role="option" aria-selected={template === t.id} className="choice-card" data-on={template === t.id} onClick={() => pickTemplate(t.id)}>
                        <span style={{ flexGrow: 1, minWidth: 0 }}><b>{t.title}</b><span>{t.shape} · {t.components} component{t.components === 1 ? "" : "s"} · <span className="mono">{t.intent}</span></span></span>
                      </button>
                    ))}
                    {!shown.length && <p className="muted small">No example matches.</p>}
                  </div>
                </div>
              )}
              {start === "blank" && <p className="small muted">A Group with one line of text. Add components from the tree; the sample data starts empty.</p>}
              {start === "shell" && (
                <div className="notice gray"><div className="body"><b>The product's frame, from the spec's shell example</b>A Frame with an AppBar (search, notifications, help, the account), a main Navigation of five sections, the Outlet your screens render in, an aside with your logo as a Custom slot, and a Footer. Named after your product; {SHELL_TEMPLATE ? SHELL_TEMPLATE.components - 2 : 0} components. Your product renders it with <span className="mono">PolyxdFrame</span> and fetches it by key like any screen.</div></div>
              )}
              {start === "paste" && (
                <div className="field">
                  <label htmlFor="paste">Document</label>
                  <textarea id="paste" className="textarea mono" style={{ minHeight: 160, fontFamily: "var(--mono)", fontSize: 14 }} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{ "specVersion": "0.2.0", "surface": { … }, "root": "…", "components": [ … ], "data": { … } }' />
                  {pastedCheck && (pastedCheck.doc ? <span className="help">{pastedCheck.errors ? `${pastedCheck.errors} error${pastedCheck.errors === 1 ? "" : "s"}; you can still save it as a draft.` : `Looks good${pastedCheck.warnings ? ` (${pastedCheck.warnings} warning${pastedCheck.warnings === 1 ? "" : "s"})` : ""}.`}</span> : <span className="err">That isn't valid JSON yet.</span>)}
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: 2 }}><label htmlFor="sn">Name</label><input id="sn" className="input" value={name} placeholder={start === "template" ? selectedTemplate?.title : start === "shell" ? "Your product's name" : start === "paste" ? pastedCheck?.title : "Send money"} onChange={(e) => { setName(e.target.value); if (!keyEdited) setKey(slugOf(e.target.value)); }} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="sk">Key</label><input id="sk" className="input mono" value={key} placeholder={slugOf(name || (start === "template" ? selectedTemplate?.title ?? "" : start === "shell" ? "shell" : pastedCheck?.title ?? ""))} onChange={(e) => { setKey(slugOf(e.target.value)); setKeyEdited(true); }} /><span className="help">Your product fetches it by this.</span></div>
              </div>
              {start !== "shell" && <div className="field"><label htmlFor="si">Intent</label><input id="si" className="input mono" value={intent} placeholder={start === "template" ? selectedTemplate?.intent : start === "paste" ? pastedCheck?.intent : "money.send"} onChange={(e) => setIntent(e.target.value)} /><span className="help">What the person is trying to do, as a stable key. Memory and insights are organised by it.</span></div>}
            </div>
            <footer><button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button><button type="button" className="btn primary" onClick={create} disabled={busy}>Create screen</button></footer>
          </div>
        </>
      )}
    </Page>
  );
}
