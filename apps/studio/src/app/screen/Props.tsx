/**
 * The property panel: the selected component's props from the schema, required ones first, then
 * the optional ones that are set, then a way to add the rest. The id and key, and the props every
 * component shares, sit apart at the bottom.
 */
import { useEffect, useState } from "react";
import catalog from "@polyxd/spec/catalog/catalog.json" with { type: "json" };
import { COMMON_PROPS, SHELL_COMPONENTS, componentDef, def, defaultFor, type Doc, type S } from "../../screens/schema.ts";
import { renameNode, update } from "../../screens/tree.ts";
import { Field, type Ctx } from "./Fields.tsx";

/** The selection that stands for the document's surface rather than a component. Ids can't start with $, so it clashes with none. */
export const SURFACE = "$surface";

const SUMMARY = (catalog as { components: Record<string, { summary: string; category: string }> }).components;
const humanise = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function Props({ ctx }: { ctx: Ctx }) {
  const { node, doc } = ctx;
  const def = componentDef(node.component);
  const [idDraft, setIdDraft] = useState(node.id);
  useEffect(() => setIdDraft(node.id), [node.id]);
  if (!def) return <div className="scr-props-empty"><p className="muted small">“{node.component}” isn't a Polyxd component. Edit it in the JSON tab.</p></div>;
  const required: string[] = def.required ?? [];
  const props = Object.entries<S>(def.properties).filter(([k]) => !COMMON_PROPS.has(k));
  const shown = props.filter(([k]) => required.includes(k) || node[k] !== undefined);
  const unset = props.filter(([k]) => !required.includes(k) && node[k] === undefined);
  const setProp = (k: string, v: unknown) =>
    ctx.apply((d) => update(d, node.id, (n) => {
      if (v === undefined) {
        const { [k]: _, ...rest } = n;
        return rest as typeof n;
      }
      return { ...n, [k]: v };
    }), `${node.id}.${k}`);
  const commitId = () => {
    const next = idDraft.trim();
    if (next === node.id) return;
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(next) || doc.components.some((c) => c.id === next)) return setIdDraft(node.id);
    ctx.apply((d) => renameNode(d, node.id, next));
    ctx.select(next);
  };
  const isRoot = doc.root === node.id;
  return (
    <div className="scr-props-body">
      <div className="scr-props-head">
        <b>{node.component}</b>
        <span className="small muted">{SUMMARY[node.component]?.summary}</span>
      </div>
      {shown.map(([k, s]) => (
        <Field key={k} name={k} schema={s} value={node[k]} required={required.includes(k)} onChange={(v) => setProp(k, v)} onRemove={required.includes(k) ? undefined : () => setProp(k, undefined)} ctx={ctx} />
      ))}
      {unset.length > 0 && (
        <select className="select scr-add" value="" onChange={(e) => e.target.value && setProp(e.target.value, defaultFor(def.properties[e.target.value], { component: node.component, id: node.id, prop: e.target.value, makeChild: (allowed) => ctx.createNode(allowed[0], allowed) }))} aria-label="Add a property">
          <option value="">Add a property…</option>
          {unset.map(([k, s]) => <option key={k} value={k} title={s.description}>{humanise(k)}{s.description ? ` — ${String(s.description).slice(0, 60)}` : ""}</option>)}
        </select>
      )}
      <div className="scr-props-common">
        <div className="scr-field">
          <div className="scr-field-label"><span>Id</span>{isRoot && <span className="tag">root</span>}</div>
          <input className="input mono" value={idDraft} onChange={(e) => setIdDraft(e.target.value)} onBlur={commitId} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} spellCheck={false} />
          <span className="help">Unique in the document; references follow a rename.</span>
        </div>
        {["key", "visible", "accessibility"].map((k) => (
          node[k] !== undefined ? <Field key={k} name={k} schema={def.properties[k]} value={node[k]} onChange={(v) => setProp(k, v)} onRemove={() => setProp(k, undefined)} ctx={ctx} /> : null
        ))}
        <div className="scr-row" style={{ flexWrap: "wrap" }}>
          {["key", "visible", "accessibility"].filter((k) => node[k] === undefined).map((k) => (
            <button key={k} type="button" className="chip sm" title={def.properties[k]?.description} onClick={() => setProp(k, defaultFor(def.properties[k], { component: node.component, id: node.id, prop: k }))}>+ {k}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SURFACE_HELP: Record<string, string> = {
  kind: `A shell is the product's frame: a Frame at the root with one Outlet, always authored. ${SHELL_COMPONENTS.join(", ")} are allowed only in a shell; a surface is a screen that lives inside one.`,
  origin: "A screen a person made is authored; a generator's is generated. A shell is always authored.",
  intent: "What the person is trying to do, as a stable key like money.send. Memory and insights are organised by it.",
};

/** The surface's own props, from the schema's Surface definition: title, intent, kind, origin, and the header's parts. */
export function SurfaceProps({ doc, apply, base }: { doc: Doc; apply: Ctx["apply"]; base: Omit<Ctx, "doc" | "node"> }) {
  const d = def("Surface");
  const required: string[] = d.required ?? [];
  const props = Object.entries<S>(d.properties).filter(([k]) => k !== "id");
  // kind and origin are what makes a document a shell; they come first, then the rest that is set.
  const first = ["title", "kind", "origin", "intent"];
  const order = (k: string) => (first.includes(k) ? first.indexOf(k) : first.length);
  const shown = props.filter(([k]) => first.includes(k) || required.includes(k) || doc.surface[k] !== undefined).sort((a, b) => order(a[0]) - order(b[0]));
  const unset = props.filter(([k]) => !shown.some(([s]) => s === k));
  const ctx: Ctx = { ...base, doc, node: { id: SURFACE, component: "Surface" }, apply };
  const setProp = (k: string, v: unknown) =>
    apply((x) => {
      const surface = { ...x.surface };
      if (v === undefined) delete surface[k];
      else surface[k] = v;
      return { ...x, surface };
    }, `${SURFACE}.${k}`);
  return (
    <div className="scr-props-body">
      <div className="scr-props-head">
        <b>Surface</b>
        <span className="small muted">{doc.surface.kind === "shell" ? "A shell: the product's frame around its screens, rendered with PolyxdFrame." : "A screen: rendered with PolyxdSurface inside the product's shell."}</span>
      </div>
      {shown.map(([k, s]) => (
        <Field key={k} name={k} schema={k in SURFACE_HELP ? { ...s, description: SURFACE_HELP[k] } : s} value={doc.surface[k]} required={required.includes(k) || first.includes(k)} onChange={(v) => setProp(k, v === "" && !required.includes(k) ? undefined : v)} onRemove={required.includes(k) || first.includes(k) ? undefined : () => setProp(k, undefined)} ctx={ctx} />
      ))}
      {unset.length > 0 && (
        <select className="select scr-add" value="" onChange={(e) => e.target.value && setProp(e.target.value, defaultFor(d.properties[e.target.value], { component: "Surface", id: SURFACE, prop: e.target.value, makeChild: (allowed) => ctx.createNode(allowed[0], allowed) }))} aria-label="Add a surface property">
          <option value="">Add a property…</option>
          {unset.map(([k, s]) => <option key={k} value={k} title={s.description}>{humanise(k)}{s.description ? ` — ${String(s.description).slice(0, 60)}` : ""}</option>)}
        </select>
      )}
      <div className="scr-props-common">
        <div className="scr-field"><div className="scr-field-label"><span>Id</span></div><span className="mono small">{doc.surface.id}</span><span className="help">The document's own id; the key your product fetches by is in Details.</span></div>
        <div className="scr-field"><div className="scr-field-label"><span>Spec</span></div><span className="mono small">{String(doc.specVersion)}</span></div>
      </div>
    </div>
  );
}
