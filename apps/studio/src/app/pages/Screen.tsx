/**
 * The screen editor: the component tree on the left, the document drawn for real in the middle,
 * the selected component's props on the right; issues, sample data and the JSON docked under
 * the preview. Every change is checked as it happens; Save keeps a version; Publish makes one the
 * document a product fetches.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PackLogo } from "../packlogo.tsx";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ActionEvent } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "../screen.css";
import { api, type ScreenVersionRow } from "../api.ts";
import { useSession, type Ws } from "../App.tsx";
import { Mark } from "../mark.tsx";
import { checkDocument, issueIndex, type Issue, type Rule } from "../../screens/validate.ts";
import { addChild, duplicateNode, makeNodes, moveNode, pointers, removeNode, visibleOrder } from "../../screens/tree.ts";
import { isShell, type Doc } from "../../screens/schema.ts";
import { Tree, NodeBar, Picker, targetFor, type Target } from "../screen/Tree.tsx";
import { Preview, WIDTHS, type PreviewTheme } from "../screen/Preview.tsx";
import { Props, SURFACE, SurfaceProps } from "../screen/Props.tsx";
import type { Ctx } from "../screen/Fields.tsx";
import { BUILTIN, loadTheme, workspaceTheme, type WorkspaceTheme } from "../screen/theme.ts";

const CAN_EDIT = new Set(["owner", "design-system", "designer", "product"]);
interface Meta {
  screen: { id: string; key: string; name: string; intent: string; status: "draft" | "published" };
  versions: ScreenVersionRow[];
}
interface History {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  key: string | null;
  at: number;
}
type Dock = "issues" | "data" | "json";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const inField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export function Screen({ ws }: { ws: Ws }) {
  const { key } = useParams();
  const { toast } = useSession();
  const navigate = useNavigate();
  const canEdit = CAN_EDIT.has(ws.role);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [h, setH] = useState<History | null>(null);
  const [saved, setSaved] = useState("");
  const [loadedFrom, setLoadedFrom] = useState(0);
  const [rules, setRules] = useState<Rule[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [picker, setPicker] = useState<Target | null>(null);
  const [dock, setDock] = useState<Dock | null>("issues");
  const [pane, setPane] = useState<"tree" | "preview" | "props">("preview");
  const [wsTheme, setWsTheme] = useState<WorkspaceTheme | null | undefined>(undefined);
  const [themeId, setThemeId] = useState("shadcn");
  const [themeReady, setThemeReady] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [widthId, setWidthId] = useState("desktop");
  const [density, setDensity] = useState<"compact" | "comfortable" | "spacious">("comfortable");
  const [interact, setInteract] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saving, setSaving] = useState<{ notes: string; publish: boolean } | null>(null);
  const [details, setDetails] = useState<{ name: string; key: string; intent: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // A shell's Outlet shows a stand-in: the placeholder, or a published screen of this workspace.
  const [published, setPublished] = useState<{ key: string; name: string }[]>([]);
  const [standInKey, setStandInKey] = useState("");
  const [standIn, setStandIn] = useState<Doc | null>(null);

  const base = `/api/w/${ws.slug}/screens/${key}`;
  const loadMeta = useCallback(() => api<Meta>("GET", `${base}/versions`).then((m) => (setMeta(m), m)), [base]);
  const loadVersion = useCallback(async (n: number) => {
    const v = await api<{ document: Doc; number: number }>("GET", `${base}/versions/${n}`);
    setH({ doc: v.document, past: [], future: [], key: null, at: 0 });
    setSaved(JSON.stringify(v.document));
    setLoadedFrom(v.number);
    setSelected(v.document.root);
  }, [base]);
  useEffect(() => {
    setMeta(null);
    setH(null);
    loadMeta().then((m) => loadVersion(m.versions[0].number)).catch((e) => { toast((e as Error).message, "bad"); navigate(`/w/${ws.slug}/screens`); });
    api<{ rules: { name: string; severity: "error" | "warning"; check: Rule["check"]; enabled: number }[] }>("GET", `/api/w/${ws.slug}/rules`).then((r) => setRules(r.rules.filter((x) => x.enabled).map((x) => ({ name: x.name, severity: x.severity, check: x.check }))));
    workspaceTheme(ws.slug).then((t) => {
      setWsTheme(t);
      if (t) setThemeId("workspace");
    }).catch(() => setWsTheme(null));
    api<{ screens: { key: string; name: string; status: string; kind: string }[] }>("GET", `/api/w/${ws.slug}/screens`).then((r) => setPublished(r.screens.filter((s) => s.status === "published" && s.kind !== "shell" && s.key !== key).map((s) => ({ key: s.key, name: s.name }))));
  }, [base]);
  useEffect(() => {
    if (!standInKey) return void setStandIn(null);
    let live = true;
    api<Doc>("GET", `/api/w/${ws.slug}/screens/${standInKey}`).then((d) => live && setStandIn(d)).catch((e) => { toast((e as Error).message, "bad"); setStandInKey(""); });
    return () => { live = false; };
  }, [standInKey, ws.slug]);
  // The built-in theme's CSS, loaded when first needed; the workspace theme draws over shadcn's.
  const builtin = themeId === "workspace" ? "shadcn" : themeId;
  useEffect(() => {
    loadTheme(builtin).then(() => setThemeReady((r) => (r[builtin] ? r : { ...r, [builtin]: true })));
  }, [builtin]);

  const doc = h?.doc ?? null;
  const dirty = !!doc && JSON.stringify(doc) !== saved;
  const apply = useCallback((fn: (d: Doc) => Doc, coalesce?: string) => {
    setH((s) => {
      if (!s) return s;
      const next = fn(s.doc);
      if (next === s.doc) return s;
      const now = Date.now();
      // Keystrokes into one field fold into one undo step.
      const merge = !!coalesce && s.key === coalesce && now - s.at < 1200;
      return { doc: next, past: merge ? s.past : [...s.past.slice(-79), s.doc], future: [], key: coalesce ?? null, at: now };
    });
  }, []);
  const undo = () => setH((s) => (s && s.past.length ? { doc: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.doc, ...s.future], key: null, at: 0 } : s));
  const redo = () => setH((s) => (s && s.future.length ? { doc: s.future[0], past: [...s.past, s.doc], future: s.future.slice(1), key: null, at: 0 } : s));

  const check = useMemo(() => (doc ? checkDocument(doc, { rules }) : null), [doc, rules]);
  const errors = check?.issues.filter((i) => i.severity === "error") ?? [];
  const warnings = check?.issues.filter((i) => i.severity === "warning") ?? [];
  const issueTone = useMemo(() => {
    const m = new Map<string, "error" | "warning">();
    for (const i of check?.issues ?? []) {
      const idx = issueIndex(i.at);
      const id = idx === null ? null : doc?.components[idx]?.id;
      if (!id) continue;
      if (i.severity === "error" || !m.has(id)) m.set(id, i.severity);
    }
    return m;
  }, [check, doc]);
  const dataKey = useMemo(() => (doc ? JSON.stringify(doc.data ?? {}) : ""), [doc?.data]);
  const pointerList = useMemo(() => {
    const ps = doc ? pointers(doc.data) : [];
    const rel = new Set<string>();
    for (const p of ps) {
      const m = /\/0\/(.+)$/.exec(p.pointer);
      if (m) rel.add(m[1]);
    }
    return [...ps.map((p) => p.pointer), ...rel];
  }, [dataKey]);

  // Selection stays valid as components come and go.
  useEffect(() => {
    if (doc && selected && selected !== SURFACE && !doc.components.some((c) => c.id === selected)) setSelected(doc.root);
  }, [doc, selected]);

  const node = doc?.components.find((c) => c.id === selected) ?? null;
  const remove = (id: string) => {
    if (!doc || id === doc.root || id === SURFACE) return;
    const order = visibleOrder(doc);
    const i = order.indexOf(id);
    apply((d) => removeNode(d, id));
    setSelected(order[i - 1] ?? doc.root);
  };
  const duplicate = (id: string) => {
    if (!doc) return;
    const r = duplicateNode(doc, id);
    if (!r) return toast("Only a component in a list can be duplicated", "bad");
    apply(() => r.doc);
    setSelected(r.id);
  };
  const pick = (component: string) => {
    if (!picker) return;
    const t = picker;
    setPicker(null);
    let id = "";
    apply((d) => {
      const r = addChild(d, t.parentId, t.prop, component, t.index);
      id = r.id;
      return r.doc;
    });
    // apply runs synchronously inside setState's updater on the next render; select after it.
    setTimeout(() => id && setSelected(id), 0);
  };
  const openPicker = (target: Target | null) => (target ? setPicker(target) : toast("Select a container, or a component inside a list, to add next to", "bad"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!doc || !canEdit) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        if (inField(e.target)) return;
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        return setSaving({ notes: "", publish: false });
      }
      if (inField(e.target) || picker || saving || details || versionsOpen) return;
      if (!selected) return;
      if (e.key === "Delete" || e.key === "Backspace") return (e.preventDefault(), remove(selected));
      if (meta && e.key.toLowerCase() === "d") return (e.preventDefault(), duplicate(selected));
      if (e.key === "Escape") return setSelected(doc.root);
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (e.altKey) return apply((d) => moveNode(d, selected, e.key === "ArrowUp" ? -1 : 1));
        const order = visibleOrder(doc);
        const i = order.indexOf(selected);
        const next = order[i + (e.key === "ArrowUp" ? -1 : 1)];
        if (next) setSelected(next);
      }
      if (e.key === "Enter") openPicker(targetFor(doc, selected));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const save = async (notes: string, publish: boolean) => {
    if (!doc) return;
    setBusy(true);
    try {
      const r = await api<{ number: number; issues: Issue[] }>("POST", `${base}/versions`, { document: doc, notes });
      setSaved(JSON.stringify(doc));
      setLoadedFrom(r.number);
      if (publish) {
        await api("POST", `${base}/versions/${r.number}/publish`);
        toast(`v${r.number} is published. Your product fetches it at /api/w/${ws.slug}/screens/${key}${isShell(doc) ? " and renders it with PolyxdFrame" : ""}.`);
      } else toast(`Saved v${r.number}`);
      setSaving(null);
      await loadMeta();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const publishLoaded = async () => {
    setBusy(true);
    try {
      await api("POST", `${base}/versions/${loadedFrom}/publish`);
      toast(`v${loadedFrom} is published`);
      await loadMeta();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const unpublish = async () => {
    await api("POST", `${base}/unpublish`);
    toast("Unpublished. Your product gets a 404 for this key until a version is published again.");
    loadMeta();
  };
  const restore = async (n: number) => {
    if (dirty && !window.confirm("Restoring drops your unsaved changes. Continue?")) return;
    await loadVersion(n);
    setVersionsOpen(false);
    toast(`Showing v${n}. Save to make it the newest version.`);
  };
  const saveDetails = async () => {
    if (!details || !meta) return;
    try {
      const r = await api<{ key: string }>("PUT", base, details);
      setDetails(null);
      if (r.key !== meta.screen.key) navigate(`/w/${ws.slug}/screens/${r.key}`, { replace: true });
      else loadMeta();
      // The intent lives in the document too.
      if (details.intent !== doc?.surface.intent) apply((d) => ({ ...d, surface: { ...d.surface, ...(details.intent ? { intent: details.intent } : {}) } }));
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  };
  const onAction = (e: ActionEvent) => toast(`Would send ${e.name}${Object.keys(e.context).length ? ` with ${JSON.stringify(e.context)}` : ""}`);

  if (!meta || !doc || !check) return null;
  const shell = isShell(doc);
  const publishedVersion = meta.versions.find((v) => v.status === "published");
  const theme: PreviewTheme = themeId === "workspace" && wsTheme ? { base: "shadcn", vars: mode === "dark" && wsTheme.dark ? wsTheme.dark : wsTheme.light } : { base: builtin };
  const ctx: Ctx | null = node
    ? {
        doc,
        node,
        apply,
        select: setSelected,
        pointersList: "scr-pointers",
        openPicker: (prop) => setPicker({ parentId: node.id, prop }),
        createNode: (type) => {
          const nodes = makeNodes(doc, type);
          apply((d) => ({ ...d, components: [...d.components, ...nodes] }));
          return nodes[0].id;
        },
      }
    : null;
  const publishWhy = errors.length ? `${errors.length} error${errors.length === 1 ? "" : "s"} to fix first` : !canEdit ? `Your role (${ws.role}) can't publish` : "";
  const width = WIDTHS.find((w) => w.id === widthId)?.width ?? null;
  return (
    <div className="scr">
      <datalist id="scr-pointers">{pointerList.map((p) => <option key={p} value={p} />)}</datalist>
      <header className="scr-head">
        <Link to={`/w/${ws.slug}/screens`} className="muted" style={{ flexShrink: 0 }}>Screens /</Link>
        <h1 title={`${meta.screen.name} · ${meta.screen.key}${meta.screen.intent ? ` · ${meta.screen.intent}` : ""}`}>{meta.screen.name}</h1>
        {canEdit && <button type="button" className="btn ghost sm" onClick={() => setDetails({ name: meta.screen.name, key: meta.screen.key, intent: meta.screen.intent })}>Details</button>}
        <div className="tags">
          {shell && <span className="tag ink">Shell</span>}
          {publishedVersion ? <span className="tag ok">v{publishedVersion.number} published</span> : <span className="tag signal">Not published</span>}
          {dirty ? <span className="tag warn">Unsaved changes</span> : <span className="tag">v{loadedFrom}</span>}
          {errors.length ? <button type="button" className="tag bad" style={{ border: 0, cursor: "pointer" }} onClick={() => setDock("issues")}>{errors.length} error{errors.length === 1 ? "" : "s"}</button> : warnings.length ? <button type="button" className="tag warn" style={{ border: 0, cursor: "pointer" }} onClick={() => setDock("issues")}>{warnings.length} warning{warnings.length === 1 ? "" : "s"}</button> : <span className="tag ok"><Mark size={18} state="checked" />Checked · no issues</span>}
        </div>
        <div className="segmented scr-panes" role="tablist" aria-label="Panel">
          {(["tree", "preview", "props"] as const).map((p) => <button key={p} type="button" role="tab" aria-pressed={pane === p} onClick={() => setPane(p)}>{p === "tree" ? "Tree" : p === "preview" ? "Preview" : "Props"}</button>)}
        </div>
        <div className="actions">
          <button type="button" className="btn sm" onClick={() => setVersionsOpen(true)}>Versions <span className="muted">{meta.versions.length}</span></button>
          {canEdit && <button type="button" className="btn sm" onClick={() => setSaving({ notes: "", publish: false })} disabled={!dirty || busy} title={dirty ? "Save a new version (⌘S)" : "Nothing changed since the last version"}>Save</button>}
          {canEdit && (
            dirty ? (
              <button type="button" className="btn primary sm" onClick={() => setSaving({ notes: "", publish: true })} disabled={!!publishWhy || busy} title={publishWhy || "Save a version and publish it"}>Publish</button>
            ) : publishedVersion?.number === loadedFrom ? (
              <button type="button" className="btn sm" onClick={unpublish} disabled={busy}>Unpublish</button>
            ) : (
              <button type="button" className="btn primary sm" onClick={publishLoaded} disabled={!!publishWhy || busy} title={publishWhy || `Publish v${loadedFrom}`}>Publish v{loadedFrom}</button>
            )
          )}
        </div>
      </header>
      <div className="scr-body" data-pane={pane}>
        <aside className="scr-tree" aria-label="Component tree">
          <div className="scr-panel-head"><span style={{ flexGrow: 1 }}>Components <span className="n">{doc.components.length}</span></span>{canEdit && <button type="button" className="btn sm" onClick={() => openPicker(targetFor(doc, selected === SURFACE ? null : selected))} title="Add a component (Enter)">Add</button>}</div>
          {canEdit && <NodeBar doc={doc} selected={selected} onAdd={setPicker} onRemove={remove} onMove={(id, by) => apply((d) => moveNode(d, id, by))} onDuplicate={duplicate} />}
          <div className="scr-node scr-node-surface" role="button" tabIndex={0} aria-pressed={selected === SURFACE} data-selected={selected === SURFACE} onClick={() => setSelected(SURFACE)} onKeyDown={(e) => e.key === "Enter" && setSelected(SURFACE)} title="The document's surface: title, kind, origin">
            <span className="scr-caret-gap" />
            <span className="scr-node-main"><span className="scr-node-type">Surface</span><span className="scr-node-text">{shell ? "shell" : "surface"} · {doc.surface.title}</span></span>
          </div>
          <Tree doc={doc} selected={selected} issues={issueTone} onSelect={setSelected} onAdd={setPicker} />
        </aside>
        <section className="scr-center" aria-label="Preview">
          <div className="scr-toolbar">
            {themeId !== "workspace" ? <PackLogo id={themeId} size={32} /> : wsTheme?.template ? <PackLogo id={wsTheme.template} size={32} /> : null}
            <select className="select scr-ds" value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Design system" title={themeId === "workspace" && wsTheme ? `${wsTheme.name}, your design system` : BUILTIN.find((t) => t.id === themeId)?.name}>
              {wsTheme && <optgroup label="Your design system"><option value="workspace">{wsTheme.name}</option></optgroup>}
              {wsTheme === null && <option value="" disabled>No published design system yet</option>}
              <optgroup label="Built-in themes">{BUILTIN.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            </select>
            <div className="segmented" role="group" aria-label="Mode"><button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")}>Light</button><button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>Dark</button></div>
            <div className="segmented" role="group" aria-label="Width">{WIDTHS.map((w) => <button key={w.id} type="button" aria-pressed={widthId === w.id} onClick={() => setWidthId(w.id)}>{w.label}</button>)}</div>
            <select className="select" value={density} onChange={(e) => setDensity(e.target.value as typeof density)} aria-label="Density"><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select>
            {shell && (
              <select className="select" value={standInKey} onChange={(e) => setStandInKey(e.target.value)} aria-label="Screen in the Outlet" title="What the Outlet shows: a placeholder, or a published screen of this workspace">
                <option value="">Outlet: placeholder</option>
                {published.map((p) => <option key={p.key} value={p.key}>Outlet: {p.name}</option>)}
                {!published.length && <option value="" disabled>No published screens yet</option>}
              </select>
            )}
            <div className="segmented scr-pointer" role="group" aria-label="Pointer" style={{ marginLeft: "auto" }}><button type="button" aria-pressed={!interact} onClick={() => setInteract(false)} title="Clicking picks the component">Select</button><button type="button" aria-pressed={interact} onClick={() => setInteract(true)} title="Clicking works the screen; actions are reported, not sent">Interact</button></div>
          </div>
          {themeReady[builtin] ? (
            <Preview doc={doc} dataKey={dataKey} selected={selected} hovered={hovered} onSelect={(id) => id && setSelected(id)} onHover={setHovered} theme={theme} mode={mode} width={width} density={density} interact={interact} onAction={onAction} standIn={standInKey ? standIn : null} />
          ) : (
            <div className="scr-canvas"><p className="muted small scr-loading"><Mark size={24} state="thinking" />Loading the theme…</p></div>
          )}
          <div className="scr-dock" data-open={dock !== null}>
            <div className="tabs" role="tablist">
              {(["issues", "data", "json"] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={dock === t} onClick={() => setDock(dock === t ? null : t)}>
                  {t === "issues" ? <>Issues <span className="n">{check.issues.length || "none"}</span></> : t === "data" ? "Sample data" : "JSON"}
                </button>
              ))}
              {dock && <button type="button" className="btn ghost sm" style={{ marginLeft: "auto", alignSelf: "center" }} onClick={() => setDock(null)} aria-label="Collapse">Hide</button>}
            </div>
            {dock === "issues" && (
              <div className="scr-dock-body">
                {!check.issues.length && <p className="small muted" style={{ padding: 14 }}>Nothing to report: the schema, every reference and every binding against the sample data check out{rules.length ? `, and ${ws.name}'s ${rules.length} rule${rules.length === 1 ? "" : "s"} pass` : ""}.</p>}
                {check.issues.map((i, n) => {
                  const idx = issueIndex(i.at);
                  const id = idx === null ? null : doc.components[idx]?.id;
                  const atSurface = i.at.startsWith("/surface") || i.at === "/root";
                  return (
                    <button type="button" key={n} className="scr-issue" onClick={() => (id ? (setSelected(id), setPane("props")) : atSurface ? (setSelected(SURFACE), setPane("props")) : undefined)} title={id ? `Select ${id}` : atSurface ? "Open the surface" : undefined}>
                      <span className={`dot ${i.severity === "error" ? "bad" : "warn"}`} aria-hidden="true" />
                      <span style={{ flexGrow: 1 }}>
                        <span>{i.message}</span>
                        <span className="at" style={{ display: "block" }}>{id ? `${doc.components[idx!].component} ${id}` : i.code === "rule" ? "Workspace rule" : "Document"}{i.at !== "/" ? ` · ${i.at}` : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {dock === "data" && <JsonPane key={`data-${loadedFrom}`} label="Sample data" value={doc.data ?? {}} readOnly={!canEdit} onChange={(v) => apply((d) => ({ ...d, data: v as Record<string, unknown> }), "data")} mustBeObject />}
            {dock === "json" && <JsonPane key={`doc-${loadedFrom}`} label="Document" value={doc} readOnly={!canEdit} onChange={(v) => apply(() => v as Doc, "json")} mustBeObject />}
          </div>
        </section>
        <aside className="scr-props" aria-label="Properties">
          <div className="scr-panel-head"><span style={{ flexGrow: 1 }}>{node ? <><span className="mono">{node.id}</span></> : selected === SURFACE ? "Surface" : "Properties"}</span>{node && node.id !== doc.root && canEdit && <button type="button" className="btn ghost sm" onClick={() => remove(node.id)}>Delete</button>}</div>
          {ctx ? (
            <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}><Props ctx={ctx} /></fieldset>
          ) : selected === SURFACE ? (
            <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents" }}><SurfaceProps doc={doc} apply={apply} base={{ apply, select: setSelected, pointersList: "scr-pointers", openPicker: () => undefined, createNode: (type) => { const nodes = makeNodes(doc, type); apply((d) => ({ ...d, components: [...d.components, ...nodes] })); return nodes[0].id; } }} /></fieldset>
          ) : (
            <div className="scr-props-empty"><p className="muted small">Select a component in the tree or the preview.</p></div>
          )}
        </aside>
      </div>

      {picker && <Picker doc={doc} target={picker} onPick={pick} onClose={() => setPicker(null)} />}
      {saving && (
        <>
          <div className="drawer-scrim" onClick={() => setSaving(null)} />
          <form className="dialog" role="dialog" aria-modal="true" aria-label={saving.publish ? "Save and publish" : "Save a version"} onSubmit={(e) => { e.preventDefault(); save(saving.notes, saving.publish); }}>
            <h2>{saving.publish ? "Save and publish" : `Save as v${meta.versions[0].number + 1}`}</h2>
            <div className="field"><label htmlFor="notes">What changed</label><input id="notes" className="input" value={saving.notes} onChange={(e) => setSaving({ ...saving, notes: e.target.value })} placeholder="Optional, shown in the version list" autoFocus /></div>
            {saving.publish && <p className="small muted">v{meta.versions[0].number + 1} becomes what your product fetches at <span className="mono">/api/w/{ws.slug}/screens/{key}</span>{warnings.length ? `. It has ${warnings.length} warning${warnings.length === 1 ? "" : "s"}; warnings don't block.` : "."}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setSaving(null)}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>{saving.publish ? "Save and publish" : "Save"}</button></div>
          </form>
        </>
      )}
      {details && (
        <>
          <div className="drawer-scrim" onClick={() => setDetails(null)} />
          <form className="dialog" role="dialog" aria-modal="true" aria-label="Screen details" onSubmit={(e) => { e.preventDefault(); saveDetails(); }}>
            <h2>Screen details</h2>
            <div className="field"><label htmlFor="dn">Name</label><input id="dn" className="input" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} autoFocus /></div>
            <div className="field"><label htmlFor="dk">Key</label><input id="dk" className="input mono" value={details.key} onChange={(e) => setDetails({ ...details, key: e.target.value })} /><span className="help">Changing it changes the address your product fetches.</span></div>
            <div className="field"><label htmlFor="di">Intent</label><input id="di" className="input mono" value={details.intent} onChange={(e) => setDetails({ ...details, intent: e.target.value })} placeholder="money.send" /></div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button type="button" className="btn" onClick={() => setDetails(null)}>Cancel</button><button type="submit" className="btn primary">Save</button></div>
          </form>
        </>
      )}
      {versionsOpen && (
        <>
          <div className="drawer-scrim" onClick={() => setVersionsOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Versions">
            <header><h2>Versions</h2><button type="button" className="btn ghost sm" onClick={() => setVersionsOpen(false)}>Close</button></header>
            <div className="body" style={{ gap: 0 }}>
              {meta.versions.map((v) => (
                <div key={v.id} className="scr-version">
                  <span className="n">v{v.number}</span>
                  <span style={{ flexGrow: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{v.status === "published" && <span className="tag ok">published</span>}{v.number === loadedFrom && <span className="tag">in the editor</span>}{v.errors ? <span className="tag bad">{v.errors} error{v.errors === 1 ? "" : "s"}</span> : v.warnings ? <span className="tag warn">{v.warnings} warning{v.warnings === 1 ? "" : "s"}</span> : <span className="tag ok">Checked</span>}</span>
                    <span className="small muted" style={{ display: "block", marginTop: 4 }}>{v.author} · {when(v.created_at)}{v.notes ? ` · ${v.notes}` : ""}</span>
                  </span>
                  {v.number !== loadedFrom && <button type="button" className="btn sm" onClick={() => restore(v.number)}>Restore</button>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** A JSON textarea that applies each valid parse and says when it isn't one yet. */
function JsonPane({ label, value, onChange, readOnly, mustBeObject }: { label: string; value: unknown; onChange: (v: unknown) => void; readOnly?: boolean; mustBeObject?: boolean }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [bad, setBad] = useState<string | null>(null);
  const focused = useRef(false);
  const lastApplied = useRef(text);
  // Changes from the tree or the props show up here while nobody is typing in it.
  useEffect(() => {
    const next = JSON.stringify(value, null, 2);
    if (!focused.current && next !== lastApplied.current) {
      setText(next);
      lastApplied.current = next;
      setBad(null);
    }
  }, [value]);
  return (
    <div className="scr-dock-body" style={{ display: "flex", flexDirection: "column" }}>
      {bad && <div className="scr-json-bad">{bad}</div>}
      <textarea aria-label={label} value={text} readOnly={readOnly} spellCheck={false} onFocus={() => (focused.current = true)} onBlur={() => (focused.current = false)} onChange={(e) => {
        setText(e.target.value);
        try {
          const v = JSON.parse(e.target.value);
          if (mustBeObject && (!v || typeof v !== "object" || Array.isArray(v))) throw new Error("Expected an object");
          setBad(null);
          lastApplied.current = JSON.stringify(v, null, 2);
          onChange(v);
        } catch (err) {
          setBad(`Not applied yet: ${(err as Error).message.replace(/^JSON\.parse: /, "")}`);
        }
      }} />
    </div>
  );
}
