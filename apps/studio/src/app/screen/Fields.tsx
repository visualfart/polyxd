/**
 * A form for any prop, made from its schema node: enums become selects, booleans switches, dynamic
 * strings a text field with a "bind" toggle, arrays of objects repeatable rows, references pickers
 * of existing components (or a new one). A shape nothing here understands falls back to JSON, so
 * no prop is out of reach.
 */
import { useId, useState, type ReactNode } from "react";
import { COMPONENTS, allowedIn, defaultFor, deref, refName, type Doc, type Node, type S } from "../../screens/schema.ts";
import { resolvePointer } from "../../screens/validate.ts";

export interface Ctx {
  doc: Doc;
  node: Node;
  /** Applies a change to the whole document (for references that make new components). */
  apply: (fn: (doc: Doc) => Doc, coalesce?: string) => void;
  /** Makes a component of `type` (with the children it needs), appended to the document; returns its id. */
  createNode: (type: string, allowed: string[]) => string;
  select: (id: string) => void;
  /** Opens the component picker to add into a list slot of the current node. */
  openPicker: (prop: string) => void;
  /** The id of the datalist that lists the sample data's pointers. */
  pointersList: string;
}

export interface FieldProps {
  name: string;
  schema: S;
  value: unknown;
  onChange: (v: unknown) => void;
  ctx: Ctx;
  required?: boolean;
  /** Unsets an optional prop */
  onRemove?: () => void;
  /** Sub-fields skip the outer label frame */
  inline?: boolean;
}

const humanise = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/** The frame every field sits in: label, hover text from the schema, and the remove control for optional props. */
function Frame({ name, schema, required, onRemove, children, help }: { name: string; schema: S; required?: boolean; onRemove?: () => void; children: ReactNode; help?: ReactNode }) {
  const d = deref(schema);
  const description: string | undefined = schema.description ?? d.description;
  return (
    <div className="scr-field" title={description}>
      <div className="scr-field-label">
        <span>{humanise(name)}{required && <span className="muted" aria-hidden="true"> *</span>}</span>
        {onRemove && <button type="button" className="scr-x" onClick={onRemove} aria-label={`Remove ${name}`} title="Remove this property">×</button>}
      </div>
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function Field(props: FieldProps): ReactNode {
  const { name, schema, value, onChange, ctx, required, onRemove, inline } = props;
  const ref = refName(schema);
  const d = deref(schema);
  const wrap = (children: ReactNode, help?: ReactNode) => (inline ? <div className="scr-field" title={schema.description ?? d.description}><div className="scr-field-label"><span>{humanise(name)}</span>{onRemove && <button type="button" className="scr-x" onClick={onRemove} aria-label={`Remove ${name}`}>×</button>}</div>{children}{help && <span className="help">{help}</span>}</div> : <Frame name={name} schema={schema} required={required} onRemove={onRemove} help={help}>{children}</Frame>);

  if (ref === "Id") return wrap(<RefField {...props} />);
  if (ref === "ChildList") {
    const n = Array.isArray(value) ? value.length : 0;
    return wrap(
      <div className="scr-row">
        <span className="small muted" style={{ flexGrow: 1 }}>{n} child{n === 1 ? "" : "ren"}, in the tree</span>
        <button type="button" className="btn sm" onClick={() => ctx.openPicker(name)}>Add…</button>
      </div>,
    );
  }
  if (ref === "Template") {
    const t = (value ?? {}) as { path?: string; componentId?: string };
    return wrap(
      <div className="scr-stack">
        <PathField value={t.path ?? ""} onChange={(path) => onChange({ ...t, path })} ctx={ctx} placeholder="/items" />
        <RefField {...props} name="componentId" value={t.componentId} onChange={(componentId) => onChange({ ...t, componentId })} />
      </div>,
      "Repeats the component once per item; paths inside it are relative to the item.",
    );
  }
  if (ref === "Binding") {
    const b = (value ?? {}) as { path?: string };
    return wrap(<PathField value={b.path ?? ""} onChange={(path) => onChange({ path })} ctx={ctx} absolute />, <Resolved path={b.path} ctx={ctx} />);
  }
  if (ref === "Path") return wrap(<PathField value={typeof value === "string" ? value : ""} onChange={onChange} ctx={ctx} />);
  if (ref === "DynamicString" || ref === "DynamicNumber" || ref === "DynamicBoolean" || ref === "DynamicValue") return wrap(<DynamicField {...props} kind={ref} />);
  if (ref === "Action") return wrap(<ActionField {...props} />);
  if (ref === "Options") return wrap(<OptionsField {...props} />);
  if (ref === "Capability") return wrap(<CapabilityField {...props} />);
  if (d.enum) return wrap(<select className="select" value={String(value ?? "")} onChange={(e) => onChange(castEnum(d.enum, e.target.value))}>{value === undefined && <option value="">—</option>}{d.enum.map((o: unknown) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}</select>);
  if (d.type === "boolean") return wrap(<Switch value={value === true} onChange={onChange} label={humanise(name)} />);
  if (d.type === "number" || d.type === "integer") return wrap(<input type="number" className="input" value={typeof value === "number" ? value : ""} min={d.minimum} max={d.maximum} step={d.type === "integer" ? 1 : "any"} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />);
  if (d.type === "string") return wrap(<input className="input" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} pattern={d.pattern} />);
  if (d.type === "array") {
    const items = deref(d.items ?? {});
    if (items.type === "object" || items.properties) return wrap(<RowsField {...props} />);
    // A list of plain values, like accepted file types.
    return wrap(<input className="input" value={Array.isArray(value) ? value.join(", ") : ""} placeholder="One, two, three" onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />);
  }
  if (d.properties) return wrap(<ObjectField {...props} />);
  if (typeof d.additionalProperties === "object") return wrap(<MapField {...props} />);
  return wrap(<JsonField value={value} onChange={onChange} />);
}

function castEnum(options: unknown[], raw: string): unknown {
  return options.find((o) => String(o) === raw) ?? raw;
}

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={value} aria-label={label} className="switch" onClick={() => onChange(!value)}><i /></button>;
}

/** A JSON Pointer, with the sample data's pointers to pick from. */
function PathField({ value, onChange, ctx, absolute, placeholder }: { value: string; onChange: (v: string) => void; ctx: Ctx; absolute?: boolean; placeholder?: string }) {
  return <input className="input mono" value={value} list={ctx.pointersList} placeholder={placeholder ?? (absolute ? "/account/balance" : "/account/balance or name")} onChange={(e) => onChange(e.target.value)} spellCheck={false} />;
}

/** What a path reads from the sample data right now. */
function Resolved({ path, ctx }: { path?: string; ctx: Ctx }) {
  if (!path) return "Bind to a pointer in the sample data.";
  if (!path.startsWith("/")) return "Relative: read from each repeated item.";
  const v = resolvePointer(ctx.doc.data, path);
  if (v === undefined) return <span style={{ color: "var(--warn)" }}>Nothing at this path in the sample data.</span>;
  const shown = v === null ? "null" : typeof v === "object" ? (Array.isArray(v) ? `list of ${v.length}` : "object") : JSON.stringify(v);
  return <span>Now: <span className="mono">{shown.length > 60 ? `${shown.slice(0, 60)}…` : shown}</span></span>;
}

const isBinding = (v: unknown): v is { path: string } => !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as { path?: unknown }).path === "string";

/** A literal or a binding, with a toggle between the two. */
function DynamicField({ name, value, onChange, ctx, kind }: FieldProps & { kind: string }) {
  const bound = isBinding(value);
  const toLiteral = () => onChange(kind === "DynamicNumber" ? 0 : kind === "DynamicBoolean" ? false : "");
  const toBinding = () => onChange({ path: bound ? value.path : "" });
  const literal = bound ? null : kind === "DynamicBoolean" ? (
    <Switch value={value === true} onChange={onChange} label={humanise(name)} />
  ) : kind === "DynamicNumber" ? (
    <input type="number" className="input" value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
  ) : (
    <input className="input" value={value === undefined || value === null ? "" : String(value)} onChange={(e) => onChange(kind === "DynamicValue" ? castValue(e.target.value) : e.target.value)} />
  );
  return (
    <div className="scr-stack">
      <div className="scr-row">
        {bound ? <PathField value={value.path} onChange={(path) => onChange({ path })} ctx={ctx} /> : literal}
        <button type="button" className={`chip sm ${bound ? "" : ""}`} aria-pressed={bound} onClick={bound ? toLiteral : toBinding} title={bound ? "Use a fixed value instead" : "Read this from the sample data"}>{bound ? "Bound" : "Bind"}</button>
      </div>
      {bound && <span className="help"><Resolved path={value.path} ctx={ctx} /></span>}
    </div>
  );
}

/** "12" is a number and "true" a boolean where the schema allows either. */
const castValue = (s: string): unknown => (s === "true" ? true : s === "false" ? false : s !== "" && !Number.isNaN(Number(s)) ? Number(s) : s);

function CapabilityField({ value, onChange, ctx }: FieldProps) {
  const listId = useId();
  const names = new Set<string>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o.event && typeof (o.event as { name?: unknown }).name === "string") names.add((o.event as { name: string }).name);
    for (const x of Object.values(o)) walk(x);
  };
  walk(ctx.doc.components);
  return (
    <>
      <input className="input mono" value={typeof value === "string" ? value : ""} list={listId} placeholder="transfer.confirm" onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      <datalist id={listId}>{[...names, "ui.dismiss", "ui.back", "ui.next", "ui.copy"].map((n) => <option key={n} value={n} />)}</datalist>
    </>
  );
}

/** An event name and the values sent with it. */
function ActionField({ value, onChange, ctx, name }: FieldProps) {
  const a = (value ?? { event: { name: "" } }) as { event: { name: string; context?: Record<string, unknown> } };
  const context = a.event.context ?? {};
  const set = (next: Record<string, unknown>) => onChange({ event: { name: a.event.name, ...(Object.keys(next).length ? { context: next } : {}) } });
  const [draftKey, setDraftKey] = useState("");
  return (
    <div className="scr-stack">
      <CapabilityField name={name} schema={{}} value={a.event.name} onChange={(n) => onChange({ event: { ...a.event, name: n as string } })} ctx={ctx} />
      {Object.entries(context).map(([k, v]) => (
        <div className="scr-row" key={k}>
          <span className="mono small" style={{ width: 96, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis" }} title={k}>{k}</span>
          <div style={{ flexGrow: 1, minWidth: 0 }}><DynamicField name={k} schema={{}} value={v} onChange={(nv) => set({ ...context, [k]: nv })} ctx={ctx} kind="DynamicValue" /></div>
          <button type="button" className="scr-x" aria-label={`Remove ${k} from the context`} onClick={() => { const { [k]: _, ...rest } = context; set(rest); }}>×</button>
        </div>
      ))}
      <form className="scr-row" onSubmit={(e) => { e.preventDefault(); const k = draftKey.trim(); if (k && !(k in context)) { set({ ...context, [k]: { path: "" } }); setDraftKey(""); } }}>
        <input className="input mono" value={draftKey} placeholder="Add to the context: amount" onChange={(e) => setDraftKey(e.target.value)} aria-label="Context key" />
        <button type="submit" className="btn sm" disabled={!draftKey.trim()}>Add</button>
      </form>
    </div>
  );
}

/** A fixed list of options, or options read from the data. */
function OptionsField(props: FieldProps) {
  const { value, onChange, schema } = props;
  const d = deref(schema);
  const [listSchema, dataSchema] = d.oneOf as [S, S];
  const fromData = !!value && !Array.isArray(value) && typeof value === "object";
  return (
    <div className="scr-stack">
      <div className="segmented" style={{ alignSelf: "flex-start" }}>
        <button type="button" aria-pressed={!fromData} onClick={() => fromData && onChange([{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }])}>Fixed list</button>
        <button type="button" aria-pressed={fromData} onClick={() => !fromData && onChange({ path: "/", valuePath: "id", labelPath: "name" })}>From data</button>
      </div>
      {fromData ? <ObjectField {...props} schema={dataSchema} /> : <RowsField {...props} schema={listSchema} />}
    </div>
  );
}

/** A component reference: an existing component of an allowed type, or a new one. */
function RefField({ name, value, onChange, ctx }: FieldProps) {
  const allowed = allowedIn(ctx.node.component, name === "componentId" ? "items" : name);
  const id = typeof value === "string" ? value : "";
  const target = ctx.doc.components.find((c) => c.id === id);
  const candidates = ctx.doc.components.filter((c) => c.id !== ctx.node.id && (allowed === COMPONENTS || allowed.includes(c.component)));
  const pick = (v: string) => {
    if (v.startsWith("new:")) onChange(ctx.createNode(v.slice(4), allowed));
    else onChange(v || undefined);
  };
  return (
    <div className="scr-row">
      <select className="select" value={id} onChange={(e) => pick(e.target.value)} aria-label={humanise(name)}>
        <option value="">—</option>
        {id && !target && <option value={id}>{id} (missing)</option>}
        {candidates.length > 0 && <optgroup label="Existing">{candidates.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.component}</option>)}</optgroup>}
        <optgroup label="New">{allowed.map((t) => <option key={t} value={`new:${t}`}>New {t}…</option>)}</optgroup>
      </select>
      {target && <button type="button" className="btn ghost sm" onClick={() => ctx.select(target.id)} title="Select it in the tree">Go</button>}
    </div>
  );
}

/** Nested object: its required props, the optional ones that are set, and a way to add the rest. */
export function ObjectField({ schema, value, onChange, ctx, name }: FieldProps) {
  const d = deref(schema);
  const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const required: string[] = d.required ?? [];
  const props = Object.entries<S>(d.properties ?? {});
  const unset = props.filter(([k]) => !required.includes(k) && obj[k] === undefined);
  const set = (k: string, v: unknown) => {
    if (v === undefined) {
      const { [k]: _, ...rest } = obj;
      onChange(rest);
    } else onChange({ ...obj, [k]: v });
  };
  return (
    <div className="scr-object">
      {props.filter(([k]) => required.includes(k) || obj[k] !== undefined).map(([k, s]) => (
        <Field key={k} name={k} schema={s} value={obj[k]} required={required.includes(k)} onChange={(v) => set(k, v)} onRemove={required.includes(k) ? undefined : () => set(k, undefined)} ctx={ctx} inline />
      ))}
      {unset.length > 0 && (
        <select className="select scr-add" value="" onChange={(e) => e.target.value && set(e.target.value, defaultFor(d.properties[e.target.value], { component: ctx.node.component, id: ctx.node.id, prop: e.target.value }))} aria-label={`Add a property to ${humanise(name)}`}>
          <option value="">Add…</option>
          {unset.map(([k, s]) => <option key={k} value={k} title={s.description}>{humanise(k)}</option>)}
        </select>
      )}
    </div>
  );
}

/** Rows of objects: a table's columns, a receipt's lines, a form's steps. */
function RowsField({ schema, value, onChange, ctx, name }: FieldProps) {
  const d = deref(schema);
  const rows = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState<number | null>(rows.length === 1 ? 0 : null);
  const items = d.items ?? {};
  const setRow = (i: number, v: unknown) => onChange(rows.map((r, j) => (j === i ? v : r)));
  const move = (i: number, by: number) => {
    const next = [...rows];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    onChange(next);
    setOpen(i + by);
  };
  const add = () => {
    onChange([...rows, defaultFor(items, { component: ctx.node.component, id: ctx.node.id, prop: name, index: rows.length, makeChild: (allowed) => ctx.createNode(allowed[0] === "Text" || allowed.length > 5 ? "Group" : allowed[0], allowed) })]);
    setOpen(rows.length);
  };
  const summary = (r: unknown, i: number) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const text = [o.label, o.title, o.key, o.name, o.value].find((v) => typeof v === "string" || typeof v === "number");
    return text !== undefined ? String(text) : isBinding(o.label) ? o.label.path : `Row ${i + 1}`;
  };
  return (
    <div className="scr-rows">
      {rows.map((r, i) => (
        <div key={i} className="scr-rowitem" data-open={open === i}>
          <div className="scr-rowhead">
            <button type="button" className="scr-rowtoggle" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span className="scr-caret" aria-hidden="true" />{summary(r, i)}</button>
            <button type="button" className="scr-x" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="scr-x" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="scr-x" aria-label="Remove row" onClick={() => { onChange(rows.filter((_, j) => j !== i)); setOpen(null); }}>×</button>
          </div>
          {open === i && <ObjectField name={`${name} ${i + 1}`} schema={items} value={r} onChange={(v) => setRow(i, v)} ctx={ctx} />}
        </div>
      ))}
      <button type="button" className="btn sm" onClick={add} disabled={d.maxItems !== undefined && rows.length >= d.maxItems}>Add {humanise(name).replace(/s$/, "").toLowerCase()}</button>
    </div>
  );
}

/** Free keys with typed values: a status column's tones, an event's context. */
function MapField({ schema, value, onChange, ctx }: FieldProps) {
  const d = deref(schema);
  const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  const [draft, setDraft] = useState("");
  return (
    <div className="scr-stack">
      {Object.entries(obj).map(([k, v]) => (
        <div className="scr-row" key={k}>
          <span className="mono small" style={{ width: 96, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis" }} title={k}>{k}</span>
          <div style={{ flexGrow: 1, minWidth: 0 }}><Field name={k} schema={d.additionalProperties} value={v} onChange={(nv) => onChange({ ...obj, [k]: nv })} ctx={ctx} inline /></div>
          <button type="button" className="scr-x" aria-label={`Remove ${k}`} onClick={() => { const { [k]: _, ...rest } = obj; onChange(rest); }}>×</button>
        </div>
      ))}
      <form className="scr-row" onSubmit={(e) => { e.preventDefault(); const k = draft.trim(); if (k && !(k in obj)) { onChange({ ...obj, [k]: defaultFor(d.additionalProperties, { component: ctx.node.component, id: ctx.node.id, prop: k }) }); setDraft(""); } }}>
        <input className="input mono" value={draft} placeholder="Key" onChange={(e) => setDraft(e.target.value)} aria-label="New key" />
        <button type="submit" className="btn sm" disabled={!draft.trim()}>Add</button>
      </form>
    </div>
  );
}

/** The last resort: the value as JSON. */
export function JsonField({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <div className="scr-stack">
      <textarea className="textarea mono" style={{ minHeight: 80, fontFamily: "var(--mono)", fontSize: 12 }} value={text} spellCheck={false} onChange={(e) => {
        setText(e.target.value);
        try {
          onChange(JSON.parse(e.target.value));
          setBad(false);
        } catch {
          setBad(true);
        }
      }} />
      {bad && <span className="err">Not valid JSON yet; the last good value stays.</span>}
    </div>
  );
}
