/**
 * The workspace's Design Directions: each a team's taste as one versioned file (profile, voice,
 * patterns, rules, exemplars) that products fetch by key. Start one blank, from one of the spec's
 * two examples, or from a Direction file.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type DirectionRow } from "../api.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { blankDirection, slugOf, type Direction } from "../../direction/model.ts";
import { validateDirection } from "../../direction/schema.ts";
import "../direction.css";

const CAN_EDIT = new Set(["owner", "design-system", "designer"]);
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const files = import.meta.glob("../../../../../packages/spec/examples/directions/*.json", { eager: true, import: "default" }) as Record<string, Direction & { $schema?: string }>;
const EXAMPLES = Object.values(files).map((d) => {
  const { $schema: _, ...rest } = d;
  return rest as Direction;
});
const EXAMPLE_WORDS: Record<string, string> = {
  "calm-finance": "Comfortable, calm and exact: key figures over charts, strict patterns, British spelling, no exclamation marks.",
  "playful-personal": "Compact and lively: charts first, everything on show, “we” and “you”, emoji allowed.",
};

export function Directions({ ws }: { ws: Ws }) {
  const { toast } = useSession();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT.has(ws.role);
  const [list, setList] = useState<DirectionRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [start, setStart] = useState<"blank" | "example" | "file">("blank");
  const [example, setExample] = useState(EXAMPLES[0]?.name ?? "");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api<{ directions: DirectionRow[] }>("GET", `/api/w/${ws.slug}/directions`).then((r) => setList(r.directions));
  useEffect(() => {
    load();
  }, [ws.slug]);

  const parsed = useMemo(() => {
    if (start !== "file" || !pasted.trim()) return null;
    try {
      const d = JSON.parse(pasted);
      return { d, problems: validateDirection({ ...d, name: slugOf(key || name || d?.name || "direction") || "direction" }) };
    } catch {
      return { d: null, problems: [] };
    }
  }, [start, pasted, key, name]);

  const open = () => {
    setCreating(true);
    setName("");
    setKey("");
    setKeyEdited(false);
    setPasted("");
    setStart(list?.length ? "blank" : "example");
  };
  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setPasted(await f.text());
  };
  const create = async () => {
    const base = start === "example" ? EXAMPLES.find((e) => e.name === example) : start === "file" ? parsed?.d : undefined;
    if (start === "file" && !base) return toast("Choose or paste a Direction file first", "bad");
    const title = name.trim() || (start === "example" ? example.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : typeof base?.name === "string" ? base.name : "");
    if (!title) return toast("Give it a name", "bad");
    const k = key || slugOf(title);
    // A file that doesn't fit the schema yet starts from the defaults and opens in the editor, where each problem shows beside its field.
    const fix = start === "file" && !!parsed?.problems.length;
    const { $schema: _, ...direction } = (fix || !base ? blankDirection(k) : base) as Direction & { $schema?: string };
    setBusy(true);
    try {
      const r = await api<{ key: string }>("POST", `/api/w/${ws.slug}/directions`, { name: title, key: k, direction, notes: start === "example" ? `From the spec's ${example}` : start === "file" && !fix ? "Imported" : "" });
      navigate(`/w/${ws.slug}/directions/${r.key}`, fix ? { state: { importing: base } } : undefined);
    } catch (e) {
      const issues = e instanceof ApiError ? (e.data.issues as { message: string }[] | undefined) : undefined;
      toast(issues?.length ? `That file doesn't fit the schema yet: ${issues[0].message}${issues.length > 1 ? ` (and ${issues.length - 1} more)` : ""}` : (e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (d: DirectionRow) => {
    if (!window.confirm(`Delete “${d.name}” and all ${d.versions} version${d.versions === 1 ? "" : "s"}? A product fetching it by key will get a 404.`)) return;
    await api("DELETE", `/api/w/${ws.slug}/directions/${d.key}`);
    toast(`Deleted “${d.name}”`);
    load();
  };

  if (!list) return null;
  return (
    <Page crumbs={[ws.name, "Direction", "Directions"]} title="Directions" lede="Your team's taste as one file a generator follows and the verifier checks: how dense and emphatic screens are, how the copy sounds, which patterns you prefer, your rules, and screens that show how you'd do it. Products fetch the published one by key." actions={canEdit && <button type="button" className="btn primary" onClick={open}>New Direction</button>}>
      {!list.length && (
        <div className="empty" style={{ maxWidth: 580 }}>
          <h2>No Direction yet</h2>
          <p>A Direction holds what tokens can't: density, voice, patterns, rules and exemplars, versioned like a screen and fetched by key. Start from one of the spec's two examples and make it yours.</p>
          {canEdit && <button type="button" className="btn" onClick={open}>New Direction</button>}
        </div>
      )}
      {!!list.length && (
        <table>
          <thead><tr><th>Direction</th><th>Key</th><th>Version</th><th>Status</th><th>Saved versions</th><th>Updated</th><th></th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="row-link" onClick={() => navigate(`/w/${ws.slug}/directions/${d.key}`)}>
                <td><b>{d.name}</b></td>
                <td className="mono small">{d.key}</td>
                <td className="mono small">{d.version ?? "—"}</td>
                <td>{d.status === "published" ? <span className="tag ok">v{d.published} published</span> : <span className="tag signal">draft</span>}</td>
                <td className="num">{d.versions}</td>
                <td className="small muted">{when(d.updated_at)}</td>
                <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <Link className="btn ghost sm" to={`/w/${ws.slug}/directions/${d.key}`}>Open</Link>
                  {canEdit && <button type="button" className="btn ghost sm" onClick={() => remove(d)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {creating && (
        <>
          <div className="drawer-scrim" onClick={() => setCreating(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="New Direction" style={{ width: 600 }}>
            <header><h2>New Direction</h2><button type="button" className="btn ghost sm" onClick={() => setCreating(false)}>Close</button></header>
            <div className="body">
              <div className="segmented" role="tablist" aria-label="Start from">
                {(["blank", "example", "file"] as const).map((s) => <button key={s} type="button" role="tab" aria-pressed={start === s} onClick={() => setStart(s)}>{s === "blank" ? "The defaults" : s === "example" ? "An example" : "A Direction file"}</button>)}
              </div>
              {start === "blank" && <p className="small muted">The schema's defaults, written out: comfortable density, one primary action, subtle motion, detail tucked away, guided freedom, and a voice that says “you” in sentence case. Change any of it in the editor.</p>}
              {start === "example" && (
                <div className="dir-choices" role="listbox" aria-label="Examples">
                  {EXAMPLES.map((e) => (
                    <button key={e.name} type="button" role="option" aria-selected={example === e.name} className="choice-card" data-on={example === e.name} onClick={() => setExample(e.name)}>
                      <span style={{ flexGrow: 1, minWidth: 0 }}><b>{e.name}</b><span>{EXAMPLE_WORDS[e.name] ?? `${e.profile.density ?? "comfortable"} · ${e.voice?.person ?? "you"}`}</span></span>
                    </button>
                  ))}
                </div>
              )}
              {start === "file" && (
                <div className="field">
                  <label htmlFor="dir-paste">Direction JSON</label>
                  <textarea id="dir-paste" className="textarea mono" style={{ minHeight: 180, fontFamily: "var(--mono)", fontSize: 14 }} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{ "name": "acme", "version": "1.0.0", "profile": { … }, "voice": { … } }' />
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label className="btn sm" style={{ fontWeight: 600, fontSize: 15 }}>Choose a file<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => readFile(e.target.files?.[0])} /></label>
                    {parsed && (parsed.d ? <span className={parsed.problems.length ? "err" : "help"}>{parsed.problems.length ? `${parsed.problems.length} problem${parsed.problems.length === 1 ? "" : "s"} to fix in the editor, starting with: ${parsed.problems[0].message}` : "Fits the schema."}</span> : <span className="err">That isn't valid JSON yet.</span>)}
                  </span>
                  <span className="help">Its rules aren't copied: rules live on the Rules page. Open the Direction after creating it to add any it has that the workspace doesn't.</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: 2 }}><label htmlFor="dn">Name</label><input id="dn" className="input" value={name} placeholder={start === "example" ? example : ws.name} onChange={(e) => { setName(e.target.value); if (!keyEdited) setKey(slugOf(e.target.value)); }} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="dk">Key</label><input id="dk" className="input mono" value={key} placeholder={slugOf(name || (start === "example" ? example : ws.name))} onChange={(e) => { setKey(slugOf(e.target.value)); setKeyEdited(true); }} /><span className="help">Your product fetches it by this.</span></div>
              </div>
            </div>
            <footer><button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button><button type="button" className="btn primary" onClick={create} disabled={busy || (start === "file" && !parsed?.d)}>{start === "file" && parsed?.problems.length ? "Create and fix" : "Create Direction"}</button></footer>
          </div>
        </>
      )}
    </Page>
  );
}
