/**
 * What the Direction editor's sections share: how they change the Direction, how a problem the
 * schema found is shown beside its control, and a few small controls (a list of lines, a list of
 * words, a choice of options).
 */
import { useState, type ReactNode } from "react";
import type { Snapshot } from "../../direction/model.ts";
import type { Option } from "../../direction/labels.ts";

export type Update = (fn: (s: Snapshot) => void) => void;
export interface Issue {
  at: string;
  message: string;
  /** The team pattern it is in, when it is in one */
  pattern?: string;
}
export interface SectionProps {
  snap: Snapshot;
  update: Update;
  issues: Issue[];
  canEdit: boolean;
}

/** The problems at a place (and, with `under`, anywhere inside it). */
export const issuesAt = (issues: Issue[], at: string, under = false) => issues.filter((i) => !i.pattern && (i.at === at || (under && i.at.startsWith(`${at}/`))));

/** A problem beside its control, in the field's own error style. */
export function Err({ issues, at, under }: { issues: Issue[]; at: string; under?: boolean }) {
  const hits = issuesAt(issues, at, under);
  if (!hits.length) return null;
  return <>{hits.map((i) => <span key={i.at + i.message} className="err" role="alert">{i.message}</span>)}</>;
}

/** A card of the editor: a heading, a line on what it's for, and its controls. */
export function Card({ title, lede, children, aside, id }: { title: string; lede?: ReactNode; children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <section className="card dir-card" aria-labelledby={id} id={id ? `${id}-card` : undefined}>
      <div className="dir-card-head">
        <div style={{ minWidth: 0, flexGrow: 1 }}>
          <h2 id={id}>{title}</h2>
          {lede && <p className="small muted">{lede}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Options as a segmented control; the option's help shows under it. */
export function Choice({ label, options, value, fallback, onChange, disabled, id }: { label: string; options: Option[]; value: string | undefined; fallback?: string; onChange: (v: string) => void; disabled?: boolean; id: string }) {
  const current = value ?? fallback;
  const help = options.find((o) => o.value === current)?.help;
  return (
    <div className="field">
      <span className="dir-label" id={id}>{label}{value === undefined && fallback !== undefined && <span className="tag" style={{ marginLeft: 8, height: 22 }}>default</span>}</span>
      <div className="segmented dir-seg" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={current === o.value} aria-pressed={current === o.value} disabled={disabled} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
      {help && <span className="help">{help}</span>}
    </div>
  );
}

/** Lines of text, one input each, added and removed in place. */
export function Lines({ label, values, onChange, placeholder, issues, at, disabled, addLabel }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string; issues: Issue[]; at: string; disabled?: boolean; addLabel: string }) {
  return (
    <div className="field">
      <span className="dir-label">{label}</span>
      <div className="dir-lines">
        {values.map((v, i) => (
          <div key={i} className="dir-line">
            <input className="input" aria-label={`${label} ${i + 1}`} value={v} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
            {!disabled && <button type="button" className="dir-x" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(values.filter((_, j) => j !== i))}>×</button>}
            <Err issues={issues} at={`${at}/${i}`} />
          </div>
        ))}
        {!disabled && <button type="button" className="btn ghost sm dir-add" onClick={() => onChange([...values, ""])}>+ {addLabel}</button>}
      </div>
      <Err issues={issues} at={at} />
    </div>
  );
}

/** Words as chips, with an input that adds one on Enter or a comma. */
export function Words({ label, values, onChange, placeholder, disabled, tone, id }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean; tone?: "bad"; id: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const words = text.split(",").map((w) => w.trim()).filter((w) => w && !values.includes(w));
    if (words.length) onChange([...values, ...words]);
    setText("");
  };
  return (
    <div className="dir-words" role="group" aria-labelledby={id}>
      {values.map((w) => (
        <span key={w} className={`dir-chip ${tone ?? ""}`}>
          <span>{w}</span>
          {!disabled && <button type="button" aria-label={`Remove “${w}” from ${label.toLowerCase()}`} onClick={() => onChange(values.filter((x) => x !== w))}>×</button>}
        </span>
      ))}
      {!disabled && (
        <input className="input dir-word-input" aria-label={`Add to ${label.toLowerCase()}`} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={add} onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }} />
      )}
    </div>
  );
}
