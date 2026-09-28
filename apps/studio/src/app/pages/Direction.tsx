/**
 * The Direction editor: a team's taste as the spec's Direction, section by section (profile,
 * voice, patterns, exemplars, and the workspace's rules and components it sits with), checked
 * against the schema on every change, saved in versions, compared field by field with what is
 * published, published for products to fetch by key, and exported or imported as a file.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "@polyxd/react/styles.css";
import "../direction.css";
import { api, ApiError, type DirectionVersionRow } from "../api.ts";
import { track } from "../analytics.ts";
import { Page, useSession, type Ws } from "../App.tsx";
import { Mark } from "../mark.tsx";
import { fromImport, rulesFromWorkspace, toExport, toStored, type DirectionRule, type Snapshot, type WorkspaceRule } from "../../direction/model.ts";
import { checkDirection } from "../../direction/schema.ts";
import { diffDirections, summarise } from "../../direction/diff.ts";
import { ProfileSection } from "../direction/Profile.tsx";
import { VoiceSection } from "../direction/Voice.tsx";
import { PatternsSection } from "../direction/Patterns.tsx";
import { ExemplarsSection, type ScreenOption } from "../direction/Exemplars.tsx";
import { ChangeList } from "../direction/Changes.tsx";
import { Card, type Issue } from "../direction/common.tsx";
import { RulesPanel } from "./Rules.tsx";
import { ComponentsPanel } from "./Components.tsx";
import { BUILTIN, loadTheme, workspaceTheme } from "../screen/theme.ts";
import type { PreviewTheme } from "../screen/Preview.tsx";

const CAN_EDIT = new Set(["owner", "design-system", "designer"]);
const TABS = [
  { id: "profile", label: "Profile" },
  { id: "voice", label: "Voice" },
  { id: "patterns", label: "Patterns" },
  { id: "exemplars", label: "Exemplars" },
  { id: "rules", label: "Rules" },
  { id: "components", label: "Components" },
  { id: "json", label: "JSON" },
] as const;
type Tab = (typeof TABS)[number]["id"];
/** Which tab a problem at a place belongs to. */
const tabOf = (i: Issue): Tab => {
  if (i.pattern) return "patterns";
  const top = i.at.split("/")[1] ?? "";
  if (["profile", "version", "designSystem", "name"].includes(top)) return "profile";
  if (top === "voice") return "voice";
  if (top === "patterns") return "patterns";
  if (top === "exemplars") return "exemplars";
  if (top === "rules") return "rules";
  return "json";
};
interface Meta {
  direction: { id: string; key: string; name: string; status: "draft" | "published" };
  versions: DirectionVersionRow[];
}
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** 1.2.0 → 1.3.0; anything else stays as it is for the designer to change. */
const nextVersion = (v: string) => {
  const m = /^(\d+)\.(\d+)\.(\d+)(.*)$/.exec(v.trim());
  return m ? `${m[1]}.${Number(m[2]) + 1}.0` : v;
};

export function DirectionEditor({ ws }: { ws: Ws }) {
  const { key = "" } = useParams();
  const { toast } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "profile") as Tab;
  const canEdit = CAN_EDIT.has(ws.role);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState<{ number: number; snapshot: Snapshot } | null>(null);
  const [published, setPublished] = useState<{ number: number; snapshot: Snapshot } | null>(null);
  const [wsRules, setWsRules] = useState<WorkspaceRule[] | null>(null);
  const [screens, setScreens] = useState<ScreenOption[]>([]);
  const [components, setComponents] = useState<string[]>([]);
  const [designSystems, setDesignSystems] = useState<string[]>([]);
  const [theme, setTheme] = useState<PreviewTheme | null>(null);
  const [newRules, setNewRules] = useState<DirectionRule[]>([]);
  const [saving, setSaving] = useState<{ notes: string; version: string; publish: boolean } | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [details, setDetails] = useState<{ name: string; key: string } | null>(null);
  const [drawer, setDrawer] = useState<"versions" | "changes" | null>(null);
  const [compareWith, setCompareWith] = useState<number | null>(null);
  const [compared, setCompared] = useState<{ number: number; snapshot: Snapshot } | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/api/w/${ws.slug}/directions/${key}`;
  const version = useCallback((n: number) => api<{ number: number; snapshot: Snapshot }>("GET", `${base}/versions/${n}`), [base]);
  const loadMeta = useCallback(async () => {
    const m = await api<Meta>("GET", `${base}/versions`);
    setMeta(m);
    const p = m.versions.find((v) => v.status === "published");
    setPublished(p ? await version(p.number) : null);
    return m;
  }, [base, version]);
  const loadRules = useCallback(() => api<{ rules: WorkspaceRule[] }>("GET", `/api/w/${ws.slug}/rules`).then((r) => setWsRules(r.rules)), [ws.slug]);
  const open = useCallback(async (n: number) => {
    const v = await version(n);
    setLoaded(v);
    setSnap(structuredClone(v.snapshot));
  }, [version]);

  useEffect(() => {
    setMeta(null);
    setSnap(null);
    loadMeta().then((m) => open(m.versions[0].number)).catch((e) => { toast((e as Error).message, "bad"); navigate(`/w/${ws.slug}/directions`); });
    loadRules();
    api<{ screens: ScreenOption[] }>("GET", `/api/w/${ws.slug}/screens`).then((r) => setScreens(r.screens));
    api<{ components: { name: string; enabled: boolean }[] }>("GET", `/api/w/${ws.slug}/components`).then((r) => setComponents(r.components.filter((c) => c.enabled).map((c) => c.name)));
    api<{ designSystems: { name: string }[] }>("GET", `/api/w/${ws.slug}/design-systems`).then((r) => setDesignSystems([...r.designSystems.map((d) => d.name), ...BUILTIN.map((b) => b.id)]));
    Promise.all([loadTheme("shadcn"), workspaceTheme(ws.slug).catch(() => null)]).then(([, t]) => setTheme(t ? { base: "shadcn", vars: t.light } : { base: "shadcn" }));
  }, [base]);

  // A file chosen on the Directions page arrives here to be fixed before it is saved.
  useEffect(() => {
    const incoming = (location.state as { importing?: unknown } | null)?.importing;
    if (!incoming || !snap || !wsRules) return;
    applyImport(incoming);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [snap !== null, wsRules !== null]);

  const rules = useMemo(() => rulesFromWorkspace(wsRules ?? []), [wsRules]);
  const check = useMemo(() => (snap ? checkDirection(snap, key, rules) : null), [snap, key, rules]);
  const issues: Issue[] = check?.issues ?? [];
  const exported = useMemo(() => (check ? toExport(check.stored, key) : null), [check, key]);
  const stored = check?.stored ?? null;
  const loadedStored = useMemo(() => (loaded ? toStored(loaded.snapshot, key, rules) : null), [loaded, key, rules]);
  const edited = !!stored && !!loadedStored && !same(stored, loadedStored);
  const rulesMoved = !!loaded && !same(loaded.snapshot.direction.rules ?? [], rules);
  const dirty = edited || rulesMoved;
  const againstPublished = useMemo(() => (stored ? diffDirections(published?.snapshot ?? null, stored) : []), [stored, published]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((fn: (s: Snapshot) => void) => setSnap((s) => {
    if (!s) return s;
    const next = structuredClone(s);
    fn(next);
    return next;
  }), []);
  const setTab = (t: Tab) => setParams((p) => { p.set("tab", t); return p; }, { replace: true });

  function applyImport(raw: unknown) {
    if (!snap) return;
    try {
      const r = fromImport(raw, key, snap.patterns, rules);
      setSnap(r.snapshot);
      setNewRules(r.newRules);
      const problems = checkDirection(r.snapshot, key, rules).issues.length;
      toast(problems ? `Imported. ${problems} problem${problems === 1 ? "" : "s"} to fix before it can be saved.` : `Imported${r.newRules.length ? `; it has ${r.newRules.length} rule${r.newRules.length === 1 ? "" : "s"} the workspace doesn't (see Rules)` : ""}. Review it, then save.`, problems ? "bad" : "ok");
      if (problems) setTab(tabOf(checkDirection(r.snapshot, key, rules).issues[0]));
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  const save = async (notes: string, versionText: string, publish: boolean) => {
    if (!snap) return;
    setBusy(true);
    try {
      const toSave = structuredClone(snap);
      toSave.direction.version = versionText;
      const r = await api<{ number: number; snapshot: Snapshot }>("POST", `${base}/versions`, { ...toSave, notes });
      if (publish) {
        await api("POST", `${base}/versions/${r.number}/publish`);
        toast(`v${r.number} is published. Products fetch it at /api/w/${ws.slug}/directions/${key}.`);
      } else toast(`Saved v${r.number}`);
      setSaving(null);
      setLoaded({ number: r.number, snapshot: r.snapshot });
      setSnap(structuredClone(r.snapshot));
      await loadMeta();
    } catch (e) {
      const list = e instanceof ApiError ? (e.data.issues as Issue[] | undefined) : undefined;
      toast(list?.length ? `Not saved: ${list[0].message}${list.length > 1 ? ` (and ${list.length - 1} more)` : ""}` : (e as Error).message, "bad");
      if (list?.length) {
        setSaving(null);
        setTab(tabOf(list[0]));
      }
    } finally {
      setBusy(false);
    }
  };
  const publishLoaded = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      await api("POST", `${base}/versions/${loaded.number}/publish`);
      toast(`v${loaded.number} is published`);
      await loadMeta();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const unpublish = async () => {
    await api("POST", `${base}/unpublish`);
    toast("Unpublished. Products get a 404 for this key until a version is published again.");
    loadMeta();
  };
  const restore = async (n: number) => {
    if (dirty && !window.confirm("Opening another version drops your unsaved changes. Continue?")) return;
    await open(n);
    setDrawer(null);
    toast(`Showing v${n}. Save to make it the newest version.`);
  };
  const saveDetails = async () => {
    if (!details || !meta) return;
    try {
      const r = await api<{ key: string }>("PUT", base, details);
      setDetails(null);
      if (r.key !== meta.direction.key) navigate(`/w/${ws.slug}/directions/${r.key}${location.search}`, { replace: true });
      else loadMeta();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const addRules = async () => {
    try {
      for (const r of newRules) {
        await api("POST", `/api/w/${ws.slug}/rules`, { name: r.description, why: "", severity: r.severity, check: r.rule });
        track("rule_added", { severity: r.severity, from: "direction" }, ws.id);
      }
      toast(`Added ${newRules.length} rule${newRules.length === 1 ? "" : "s"} to the workspace`);
      setNewRules([]);
      loadRules();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const download = () => {
    if (!exported) return;
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}.direction.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const openChanges = async (n: number | null) => {
    setCompareWith(n);
    setCompared(n === null ? null : await version(n));
    setDrawer("changes");
  };

  if (!meta || !snap || !loaded || !exported || !wsRules) return null;
  const publishedRow = meta.versions.find((v) => v.status === "published");
  const latest = meta.versions[0];
  const counts = Object.fromEntries(TABS.map((t) => [t.id, issues.filter((i) => tabOf(i) === t.id).length])) as Record<Tab, number>;
  const publishWhy = issues.length ? `${issues.length} problem${issues.length === 1 ? "" : "s"} to fix first` : !canEdit ? `Your role (${ws.role}) can't publish` : "";
  const startSave = (publish: boolean) => setSaving({ notes: "", version: snap.direction.version === (latest.version ?? "") ? nextVersion(snap.direction.version ?? "0.1.0") : snap.direction.version ?? "", publish });
  const changesBase = compareWith === null ? published : compared;
  const drawerChanges = drawer === "changes" && stored ? diffDirections(changesBase?.snapshot ?? null, stored) : [];

  return (
    <Page
      crumbs={[ws.name, "Direction", "Directions", meta.direction.name]}
      title={meta.direction.name}
      lede={`Products fetch the published version at /api/w/${ws.slug}/directions/${key}.`}
      meta={
        <>
          {publishedRow ? <span className="tag ok">v{publishedRow.number} published</span> : <span className="tag signal">Not published</span>}
          {edited ? <span className="tag warn">Unsaved changes</span> : rulesMoved ? <span className="tag warn" title="The workspace's rules changed since this version was saved">Rules changed since v{loaded.number}</span> : <span className="tag">v{loaded.number} · {snap.direction.version}</span>}
          {issues.length ? <button type="button" className="tag bad" style={{ border: 0, cursor: "pointer" }} onClick={() => setTab(tabOf(issues[0]))}>{issues.length} problem{issues.length === 1 ? "" : "s"}</button> : <span className="tag ok"><Mark size={18} state="checked" />Fits the schema</span>}
          <button type="button" className="btn ghost sm" onClick={() => openChanges(null)} title="What changed since the published version">{summarise(againstPublished).replace(/:.*/, "")} {publishedRow ? `since v${publishedRow.number}` : "(nothing published)"}</button>
        </>
      }
      actions={
        <>
          {canEdit && <button type="button" className="btn ghost sm" onClick={() => setDetails({ name: meta.direction.name, key: meta.direction.key })}>Details</button>}
          <button type="button" className="btn sm" onClick={() => setDrawer("versions")}>Versions <span className="muted">{meta.versions.length}</span></button>
          {canEdit && <button type="button" className="btn sm" onClick={() => setImporting("")}>Import</button>}
          <button type="button" className="btn sm" onClick={download} disabled={!!issues.length} title={issues.length ? "Fix the problems first: an export always fits the schema" : `Download ${key}.direction.json`}>Export</button>
          {canEdit && <button type="button" className="btn sm" onClick={() => startSave(false)} disabled={!dirty || busy || !!issues.length} title={issues.length ? publishWhy : dirty ? "Save a new version" : "Nothing changed since this version"}>Save</button>}
          {canEdit && (dirty ? (
            <button type="button" className="btn primary sm" onClick={() => startSave(true)} disabled={!!publishWhy || busy} title={publishWhy || "Save a version and publish it"}>Publish</button>
          ) : publishedRow?.number === loaded.number ? (
            <button type="button" className="btn sm" onClick={unpublish} disabled={busy}>Unpublish</button>
          ) : (
            <button type="button" className="btn primary sm" onClick={publishLoaded} disabled={!!publishWhy || busy} title={publishWhy || `Publish v${loaded.number}`}>Publish v{loaded.number}</button>
          ))}
        </>
      }
    >
      <div className="tabs dir-tabs" role="tablist" aria-label="Direction">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] > 0 && <span className="dir-count" aria-label={`${counts[t.id]} problem${counts[t.id] === 1 ? "" : "s"}`}>{counts[t.id]}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
        {tab === "profile" && <ProfileSection snap={snap} update={update} issues={issues} canEdit={canEdit} designSystems={designSystems} keyName={key} />}
        {tab === "voice" && <VoiceSection snap={snap} update={update} issues={issues} canEdit={canEdit} />}
        {tab === "patterns" && <PatternsSection snap={snap} update={update} issues={issues} canEdit={canEdit} components={components} />}
        {tab === "exemplars" && <ExemplarsSection snap={snap} update={update} issues={issues} canEdit={canEdit} screens={screens} slug={ws.slug} theme={theme} />}
        {tab === "rules" && (
          <div className="dir-stack">
            <div className="notice gray"><div className="body"><b>The workspace's rules are the Direction's</b>Each Direction in {ws.name} carries the {rules.length} rule{rules.length === 1 ? "" : "s"} switched on here, as they are when you save it. Changing a rule changes what the next saved version carries; the published one keeps what it had until you publish again.</div></div>
            {!!newRules.length && (
              <div className="notice signal">
                <div className="body"><b>The file you imported has {newRules.length} rule{newRules.length === 1 ? "" : "s"} the workspace doesn't</b>{newRules.map((r) => `“${r.description}” (${r.severity})`).join(", ")}. Add {newRules.length === 1 ? "it" : "them"} to carry {newRules.length === 1 ? "it" : "them"} in this Direction.</div>
                <button type="button" className="btn sm" onClick={() => setNewRules([])}>Leave out</button>
                {canEdit && <button type="button" className="btn primary sm" onClick={addRules}>Add {newRules.length === 1 ? "it" : `all ${newRules.length}`}</button>}
              </div>
            )}
            {issues.filter((i) => tabOf(i) === "rules").map((i) => {
              const n = Number(i.at.split("/")[2]);
              return <div key={i.at + i.message} className="notice bad"><div className="body"><b>{rules[n] ? `“${rules[n].description}”` : "A rule"} doesn't fit the check vocabulary</b>{i.message}. Fix its check below, or switch it off.</div></div>;
            })}
            <RulesPanel ws={ws} onChange={loadRules} frame={(actions, body) => <><div className="dir-panel-actions">{canEdit && actions}</div>{body}</>} />
          </div>
        )}
        {tab === "components" && (
          <div className="dir-stack">
            <div className="notice gray"><div className="body"><b>Which components generators may use, and when</b>These are the workspace's, shared by every Direction in it, and the Direction file has no place for them yet: products and generators read them from Studio. Your patterns can only prefer components switched on here.</div></div>
            <ComponentsPanel ws={ws} frame={(body) => body} />
          </div>
        )}
        {tab === "json" && (
          <div className="dir-stack">
            <Card id="dir-json" title={`${key}.direction.json`} lede="Exactly what a product gets once this is published, and what Export downloads. Paths in it are relative to where it's fetched from.">
              {!!issues.length && (
                <ul className="dir-issues">
                  {issues.map((i) => <li key={(i.pattern ?? "") + i.at + i.message}><span className="dot bad" aria-hidden="true" /><span><b>{i.message}</b><span className="mono small muted" style={{ display: "block" }}>{i.pattern ? `your pattern ${i.pattern} · ` : ""}{i.at}</span></span><button type="button" className="btn ghost sm" onClick={() => setTab(tabOf(i))}>Show</button></li>)}
                </ul>
              )}
              <pre className="dir-json">{JSON.stringify(exported, null, 2)}</pre>
              <p className="small muted">Fetch it with an API key from Team → API keys: <span className="mono">curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" {window.location.origin}/api/w/{ws.slug}/directions/{key}</span></p>
            </Card>
          </div>
        )}
      </div>

      {saving && (
        <>
          <div className="drawer-scrim" onClick={() => setSaving(null)} />
          <form className="dialog dir-save" role="dialog" aria-modal="true" aria-label={saving.publish ? "Save and publish" : "Save a version"} onSubmit={(e) => { e.preventDefault(); save(saving.notes, saving.version, saving.publish); }}>
            <h2>{saving.publish ? "Save and publish" : `Save as v${latest.number + 1}`}</h2>
            <div className="dir-row">
              <div className="field" style={{ flex: "0 0 140px" }}><label htmlFor="sv-version">Version</label><input id="sv-version" className="input mono" value={saving.version} onChange={(e) => setSaving({ ...saving, version: e.target.value })} /></div>
              <div className="field" style={{ flex: 1 }}><label htmlFor="sv-notes">What changed</label><input id="sv-notes" className="input" value={saving.notes} onChange={(e) => setSaving({ ...saving, notes: e.target.value })} placeholder="Optional, shown in the version list" autoFocus /></div>
            </div>
            <div className="dir-save-changes">
              <span className="small muted">{publishedRow ? `Against v${publishedRow.number}, which products have now` : "Nothing is published yet, so all of it is new"}:</span>
              <ChangeList changes={againstPublished} empty="Nothing differs from the published version." />
            </div>
            {saving.publish && <p className="small muted">v{latest.number + 1} becomes what products fetch at <span className="mono">/api/w/{ws.slug}/directions/{key}</span>.</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setSaving(null)}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>{saving.publish ? "Save and publish" : "Save"}</button></div>
          </form>
        </>
      )}
      {importing !== null && (
        <>
          <div className="drawer-scrim" onClick={() => setImporting(null)} />
          <form className="dialog" role="dialog" aria-modal="true" aria-label="Import a Direction" style={{ width: 600 }} onSubmit={(e) => {
            e.preventDefault();
            try {
              applyImport(JSON.parse(importing));
              setImporting(null);
            } catch {
              toast("That isn't valid JSON", "bad");
            }
          }}>
            <h2>Import a Direction</h2>
            <p className="small muted">It replaces what's in the editor, as unsaved changes you can look over before saving. Its rules aren't copied over: any the workspace lacks are offered on the Rules tab. Your own patterns stay if the file still lists them.</p>
            <textarea className="textarea mono" aria-label="Direction JSON" style={{ minHeight: 200, fontFamily: "var(--mono)", fontSize: 14 }} value={importing} onChange={(e) => setImporting(e.target.value)} placeholder='{ "name": "…", "version": "1.0.0", "profile": { … } }' autoFocus />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
              <label className="btn sm" style={{ marginRight: "auto" }}>Choose a file<input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImporting(await f.text()); }} /></label>
              <button type="button" className="btn" onClick={() => setImporting(null)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={!importing.trim()}>Import</button>
            </div>
          </form>
        </>
      )}
      {details && (
        <>
          <div className="drawer-scrim" onClick={() => setDetails(null)} />
          <form className="dialog" role="dialog" aria-modal="true" aria-label="Direction details" onSubmit={(e) => { e.preventDefault(); saveDetails(); }}>
            <h2>Details</h2>
            <div className="field"><label htmlFor="dd-name">Name</label><input id="dd-name" className="input" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} autoFocus /></div>
            <div className="field"><label htmlFor="dd-key">Key</label><input id="dd-key" className="input mono" value={details.key} onChange={(e) => setDetails({ ...details, key: e.target.value })} /><span className="help">The Direction's name in its file, and the address products fetch. Changing it moves both.</span></div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setDetails(null)}>Cancel</button><button type="submit" className="btn primary">Save</button></div>
          </form>
        </>
      )}
      {drawer === "versions" && (
        <>
          <div className="drawer-scrim" onClick={() => setDrawer(null)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Versions">
            <header><h2>Versions</h2><button type="button" className="btn ghost sm" onClick={() => setDrawer(null)}>Close</button></header>
            <div className="body" style={{ gap: 0 }}>
              {meta.versions.map((v) => (
                <div key={v.id} className="scr-version">
                  <span className="n">v{v.number}</span>
                  <span style={{ flexGrow: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><span className="tag mono">{v.version}</span>{v.status === "published" && <span className="tag ok">published</span>}{v.number === loaded.number && <span className="tag">in the editor</span>}</span>
                    <span className="small muted" style={{ display: "block", marginTop: 4 }}>{v.author} · {when(v.created_at)}{v.notes ? ` · ${v.notes}` : ""}</span>
                  </span>
                  <button type="button" className="btn ghost sm" onClick={() => openChanges(v.number)}>Compare</button>
                  {v.number !== loaded.number && <button type="button" className="btn sm" onClick={() => restore(v.number)}>Open</button>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {drawer === "changes" && (
        <>
          <div className="drawer-scrim" onClick={() => setDrawer(null)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Changes" style={{ width: 600 }}>
            <header><h2>Changes</h2><button type="button" className="btn ghost sm" onClick={() => setDrawer(null)}>Close</button></header>
            <div className="body">
              <div className="field">
                <label htmlFor="cmp">Compare the editor with</label>
                <select id="cmp" className="select" value={compareWith === null ? "" : String(compareWith)} onChange={(e) => openChanges(e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">{publishedRow ? `The published version (v${publishedRow.number})` : "Nothing (nothing is published)"}</option>
                  {meta.versions.map((v) => <option key={v.number} value={v.number}>v{v.number} · {v.version}{v.status === "published" ? " · published" : ""}{v.notes ? ` · ${v.notes}` : ""}</option>)}
                </select>
                <span className="help">{summarise(drawerChanges)}</span>
              </div>
              <ChangeList changes={drawerChanges} empty="The editor matches that version exactly." />
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
