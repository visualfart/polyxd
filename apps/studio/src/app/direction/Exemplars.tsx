/**
 * Exemplars: the workspace's own screens, attached as "this is how we'd do it", each with the
 * request it answers (the note a generator retrieves it by). Each is drawn small with the same
 * renderer and theme the Screens editor uses. Exemplars from an imported file that aren't the
 * workspace's screens stay as their paths.
 */
import { Component, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";
import { api } from "../api.ts";
import { screenKeyOf, screenPath } from "../../direction/model.ts";
import type { Doc } from "../../screens/schema.ts";
import type { PreviewTheme } from "../screen/Preview.tsx";
import { Card, Err, type SectionProps } from "./common.tsx";

export interface ScreenOption {
  key: string;
  name: string;
  intent: string;
  status: string;
  kind: string;
}

export function ExemplarsSection({ snap, update, issues, canEdit, screens, slug, theme }: SectionProps & { screens: ScreenOption[]; slug: string; theme: PreviewTheme | null }) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<{ key: string; request: string }>({ key: "", request: "" });
  const list = snap.direction.exemplars ?? [];
  const used = new Set(list.map((e) => screenKeyOf(e.document)).filter(Boolean));
  const available = screens.filter((s) => s.kind !== "shell" && !used.has(s.key));
  const set = (i: number, request: string) => update((s) => void (s.direction.exemplars = list.map((e, j) => (j === i ? { ...e, request } : e))));
  const remove = (i: number) => update((s) => {
    const next = list.filter((_, j) => j !== i);
    if (next.length) s.direction.exemplars = next;
    else delete s.direction.exemplars;
  });
  const add = () => {
    if (!pick.key) return;
    update((s) => void (s.direction.exemplars = [...list, { request: pick.request.trim(), document: screenPath(pick.key) }]));
    setAdding(false);
    setPick({ key: "", request: "" });
  };
  return (
    <div className="dir-stack">
      <Card title="Exemplars" lede="Screens that show how you'd do it. A generator is given the closest ones as examples, found by the request each answers; reviewers compare against them." id="dir-exemplars"
        aside={canEdit && <button type="button" className="btn sm" onClick={() => { setAdding(true); setPick({ key: available[0]?.key ?? "", request: "" }); }} disabled={!available.length} title={available.length ? undefined : screens.length ? "Every screen is attached already" : "Design a screen first"}>Add a screen</button>}>
        {!list.length && (
          <p className="small muted">
            None yet. {screens.length ? "Attach one of the workspace's screens, and say what someone asked for that it answers." : <>Exemplars are screens from <Link to={`/w/${slug}/screens`}>Screens</Link>; design one there first.</>}
          </p>
        )}
        <div className="dir-exemplars">
          {list.map((e, i) => {
            const key = screenKeyOf(e.document);
            const screen = key ? screens.find((s) => s.key === key) : undefined;
            return (
              <article key={e.document + i} className="dir-exemplar" aria-label={screen ? screen.name : e.document}>
                {key ? <Thumb slug={slug} screenKey={key} theme={theme} missing={!screen} /> : <div className="dir-thumb dir-thumb-empty"><span className="small muted">Not a screen in this workspace</span></div>}
                <div className="dir-exemplar-body">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {screen ? <Link to={`/w/${slug}/screens/${screen.key}`}><b>{screen.name}</b></Link> : <b className="mono small" style={{ overflowWrap: "anywhere" }}>{key ?? e.document}</b>}
                    {screen && (screen.status === "published" ? <span className="tag ok">published</span> : <span className="tag signal" title="A product can fetch it once it is published">not published</span>)}
                    {key && !screen && <span className="tag bad">screen deleted</span>}
                  </div>
                  {screen?.intent && <span className="mono small muted">{screen.intent}</span>}
                  <div className="field">
                    <label htmlFor={`ex-${i}`}>The request it answers</label>
                    <input id={`ex-${i}`} className="input" value={e.request} placeholder="send Alex the rent" disabled={!canEdit} aria-invalid={issues.some((x) => x.at.startsWith(`/exemplars/${i}/request`))} onChange={(ev) => set(i, ev.target.value)} />
                    <Err issues={issues} at={`/exemplars/${i}/request`} />
                    <Err issues={issues} at={`/exemplars/${i}/document`} />
                  </div>
                  {canEdit && <button type="button" className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => remove(i)}>Remove</button>}
                </div>
              </article>
            );
          })}
        </div>
        <Err issues={issues} at="/exemplars" />
      </Card>
      {adding && (
        <>
          <div className="drawer-scrim" onClick={() => setAdding(false)} />
          <form className="drawer" role="dialog" aria-modal="true" aria-label="Add an exemplar" style={{ width: 600 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
            <header><h2>Add an exemplar</h2><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>Close</button></header>
            <div className="body">
              <div className="dir-choices" role="listbox" aria-label="Screens">
                {available.map((s) => (
                  <button key={s.key} type="button" role="option" aria-selected={pick.key === s.key} className="choice-card" data-on={pick.key === s.key} onClick={() => setPick({ ...pick, key: s.key })}>
                    <span style={{ flexGrow: 1, minWidth: 0 }}><b>{s.name}</b><span className="mono small">{s.key}{s.intent ? ` · ${s.intent}` : ""}</span></span>
                    {s.status === "published" ? <span className="tag ok">published</span> : <span className="tag signal">draft</span>}
                  </button>
                ))}
              </div>
              {pick.key && <Thumb slug={slug} screenKey={pick.key} theme={theme} />}
              <div className="field">
                <label htmlFor="ex-new">The request it answers</label>
                <input id="ex-new" className="input" value={pick.request} placeholder="send Alex the rent" onChange={(e) => setPick({ ...pick, request: e.target.value })} />
                <span className="help">In the words a person would use. The generator finds exemplars by this.</span>
              </div>
            </div>
            <footer><button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button><button type="submit" className="btn primary" disabled={!pick.key || !pick.request.trim()}>Add exemplar</button></footer>
          </form>
        </>
      )}
    </div>
  );
}

const docs = new Map<string, Promise<Doc>>();
/** The screen's newest version (what the designer sees in its editor). */
function latest(slug: string, key: string): Promise<Doc> {
  const id = `${slug}/${key}`;
  if (!docs.has(id)) {
    docs.set(id, api<{ versions: { number: number }[] }>("GET", `/api/w/${slug}/screens/${key}/versions`).then((m) => api<{ document: Doc }>("GET", `/api/w/${slug}/screens/${key}/versions/${m.versions[0].number}`)).then((v) => v.document));
    docs.get(id)!.catch(() => docs.delete(id));
  }
  return docs.get(id)!;
}

/** A screen at phone width, drawn for real and scaled down; it can't be clicked. */
export function Thumb({ slug, screenKey, theme, missing }: { slug: string; screenKey: string; theme: PreviewTheme | null; missing?: boolean }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (missing) return;
    let live = true;
    setDoc(null);
    latest(slug, screenKey).then((d) => live && setDoc(d)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [slug, screenKey, missing]);
  if (missing || failed) return <div className="dir-thumb dir-thumb-empty"><span className="small muted">{missing ? "This screen is gone" : "Couldn't draw it"}</span></div>;
  if (!doc || !theme) return <div className="dir-thumb" aria-busy="true" />;
  return (
    <div className="dir-thumb" aria-hidden="true" inert>
      <div className="dir-thumb-frame" data-pxd-theme={theme.base} data-pxd-mode="light" style={(theme.vars ?? {}) as CSSProperties}>
        <Guard>
          <PolyxdSurface document={doc as unknown as UIDocument} theme={theme.vars ? undefined : theme.base} mode="light" onAction={() => undefined} />
        </Guard>
      </div>
    </div>
  );
}

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="small muted" style={{ padding: 16 }}>Couldn't draw this screen.</p> : this.props.children;
  }
}
