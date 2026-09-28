/**
 * How the product sounds: guidelines, tone, person, casing, spelling, reading level, punctuation,
 * button labels, the words to use and to avoid, and guidance for recurring moments. Beside it, a
 * sample the designer types, checked as they type by the verifier's own copy checks.
 */
import { useMemo, useState, type ReactNode } from "react";
import { CASING, PERSON, SITUATIONS, SPELLING, TONE_FIELDS } from "../../direction/labels.ts";
import type { Voice } from "../../direction/model.ts";
import { SAMPLE, avoidedIn, checkSample, type Sample } from "../../direction/voice.ts";
import { Mark } from "../mark.tsx";
import { Card, Choice, Err, Lines, Words, type SectionProps } from "./common.tsx";

const GRADE_AGE = (g: number) => `about age ${Math.round(g + 5)}`;

export function VoiceSection({ snap, update, issues, canEdit }: SectionProps) {
  const v: Voice = snap.direction.voice ?? {};
  const setVoice = (fn: (v: Voice) => void) => update((s) => {
    const next = { ...(s.direction.voice ?? {}) };
    fn(next);
    s.direction.voice = next;
  });
  const off = !canEdit;
  const grade = v.readingLevel?.maxGrade;
  const maxWords = v.labels?.maxWords;
  return (
    <div className="dir-voice">
      <div className="dir-stack">
        <Card title="Guidelines" lede="Plain-language guidance a generator reads before it writes a word. One idea per line." id="dir-guidelines">
          <Lines label="Guideline" values={v.guidelines ?? []} onChange={(g) => setVoice((x) => void (x.guidelines = g))} placeholder="Say what happens to the person's money, and when." issues={issues} at="/voice/guidelines" disabled={off} addLabel="Add a guideline" />
        </Card>

        <Card title="Tone" lede="Where the product sits between two ends. Given to the generator; tone isn't checked." id="dir-tone">
          <div className="dir-sliders">
            {TONE_FIELDS.map((f) => {
              const cur = v.tone?.[f.key];
              const i = Math.max(0, f.options.findIndex((o) => o.value === (cur ?? f.default)));
              return (
                <div key={f.key} className="field dir-slider">
                  <label htmlFor={`dir-tone-${f.key}`} className="dir-label">{f.label}{cur === undefined && <span className="tag" style={{ marginLeft: 8, height: 22 }}>default</span>}</label>
                  <input id={`dir-tone-${f.key}`} type="range" min={0} max={f.options.length - 1} step={1} value={i} disabled={off} aria-valuetext={f.options[i].label}
                    onChange={(e) => setVoice((x) => void (x.tone = { ...(x.tone ?? {}), [f.key]: f.options[Number(e.target.value)].value }))} />
                  <div className="dir-slider-ends" aria-hidden="true">{f.options.map((o, j) => <span key={o.value} data-on={j === i}>{o.label}</span>)}</div>
                  <span className="help">{f.options[i].help}</span>
                  <Err issues={issues} at={`/voice/tone/${f.key}`} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="How it speaks" lede="The settings the verifier checks on every screen, and flags as warnings." id="dir-speaks">
          <Choice id="dir-person" label="Who's talking" options={PERSON} value={v.person} fallback="you" disabled={off} onChange={(p) => setVoice((x) => void (x.person = p))} />
          <Err issues={issues} at="/voice/person" />
          <Choice id="dir-casing" label="Casing of titles and buttons" options={CASING} value={v.casing} fallback="sentence" disabled={off} onChange={(c) => setVoice((x) => void (x.casing = c))} />
          <Err issues={issues} at="/voice/casing" />
          <div className="field">
            <span className="dir-label" id="dir-spelling">Spelling</span>
            <div className="segmented dir-seg" role="radiogroup" aria-labelledby="dir-spelling">
              {[{ value: "", label: "Either", help: "Not checked." }, ...SPELLING].map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={(v.spelling ?? "") === o.value} aria-pressed={(v.spelling ?? "") === o.value} disabled={off} onClick={() => setVoice((x) => { if (o.value) x.spelling = o.value; else delete x.spelling; })}>{o.label}</button>
              ))}
            </div>
            <span className="help">{[{ value: "", help: "Not checked: either spelling passes." }, ...SPELLING].find((o) => o.value === (v.spelling ?? ""))?.help}</span>
            <Err issues={issues} at="/voice/spelling" />
          </div>
          <div className="field">
            <div className="dir-toggle-row">
              <span className="dir-label" id="dir-grade-label">Highest reading grade</span>
              <button type="button" role="switch" aria-checked={grade !== undefined} aria-labelledby="dir-grade-label" className="switch" disabled={off} onClick={() => setVoice((x) => { if (grade === undefined) x.readingLevel = { maxGrade: 8 }; else delete x.readingLevel; })}><i /></button>
            </div>
            {grade !== undefined ? (
              <>
                <input type="range" min={3} max={16} step={1} value={grade} disabled={off} aria-label="Highest reading grade" aria-valuetext={`Grade ${grade}`} onChange={(e) => setVoice((x) => void (x.readingLevel = { maxGrade: Number(e.target.value) }))} />
                <span className="help"><b style={{ color: "var(--ink)" }}>Grade {grade}</b>, {GRADE_AGE(grade)}. Measured with Flesch–Kincaid once a screen has 30 words or more of running text.</span>
              </>
            ) : <span className="help">Off: sentences aren't measured.</span>}
            <Err issues={issues} at="/voice/readingLevel" under />
          </div>
        </Card>

        <Card title="Punctuation and buttons" id="dir-punctuation">
          <Toggle label="Exclamation marks" help={v.punctuation?.exclamation === "never" ? "Never: a label or sentence with “!” is flagged." : "Allowed."} on={v.punctuation?.exclamation !== "never"} disabled={off}
            onToggle={() => setVoice((x) => void (x.punctuation = { ...(x.punctuation ?? {}), exclamation: x.punctuation?.exclamation === "never" ? "allowed" : "never" }))} />
          <Toggle label="Emoji" help={v.punctuation?.emoji === "allowed" ? "Allowed." : "Never: any emoji in copy is flagged."} on={v.punctuation?.emoji === "allowed"} disabled={off}
            onToggle={() => setVoice((x) => void (x.punctuation = { ...(x.punctuation ?? {}), emoji: x.punctuation?.emoji === "allowed" ? "never" : "allowed" }))} />
          <Toggle label="Buttons start with what they do" help="“Send money”, not “Money transfer”. Given to the generator." on={v.labels?.verbFirst !== false} disabled={off}
            onToggle={() => setVoice((x) => void (x.labels = { ...(x.labels ?? {}), verbFirst: x.labels?.verbFirst === false }))} />
          <div className="field">
            <div className="dir-toggle-row">
              <span className="dir-label" id="dir-maxwords-label">Longest button label</span>
              <button type="button" role="switch" aria-checked={maxWords !== undefined} aria-labelledby="dir-maxwords-label" className="switch" disabled={off} onClick={() => setVoice((x) => { const l = { ...(x.labels ?? {}) }; if (maxWords === undefined) l.maxWords = 4; else delete l.maxWords; x.labels = l; })}><i /></button>
            </div>
            {maxWords !== undefined ? (
              <div className="dir-stepper">
                <button type="button" className="dir-x" aria-label="One word fewer" disabled={off || maxWords <= 1} onClick={() => setVoice((x) => void (x.labels = { ...(x.labels ?? {}), maxWords: maxWords - 1 }))}>−</button>
                <span className="num" aria-live="polite"><b>{maxWords}</b> word{maxWords === 1 ? "" : "s"}</span>
                <button type="button" className="dir-x" aria-label="One word more" disabled={off || maxWords >= 12} onClick={() => setVoice((x) => void (x.labels = { ...(x.labels ?? {}), maxWords: maxWords + 1 }))}>+</button>
              </div>
            ) : <span className="help">Off: any length passes.</span>}
            <Err issues={issues} at="/voice/labels" under />
          </div>
        </Card>

        <Card title="Words" lede="Generators use the word on the left; the verifier flags the ones on the right, and suggests the word to use." id="dir-words">
          <Glossary v={v} setVoice={setVoice} issues={issues} disabled={off} />
          <div className="field">
            <span className="dir-label" id="dir-avoid">Never say</span>
            <Words id="dir-avoid" label="Words to avoid" values={v.avoid ?? []} onChange={(a) => setVoice((x) => void (x.avoid = a))} placeholder="Type a word, then Enter" disabled={off} tone="bad" />
            <span className="help">Plurals are caught too: “error” flags “errors”.</span>
            <Err issues={issues} at="/voice/avoid" under />
          </div>
        </Card>

        <Card title="Moments" lede="How to write when something recurring happens. Given to the generator as guidance." id="dir-moments">
          <div className="dir-grid-2">
            {SITUATIONS.map((s) => (
              <div key={s.key} className="field">
                <label htmlFor={`dir-sit-${s.key}`}>{s.label}</label>
                <textarea id={`dir-sit-${s.key}`} className="textarea" rows={3} value={v.situations?.[s.key] ?? ""} placeholder={s.placeholder} disabled={off}
                  onChange={(e) => setVoice((x) => void (x.situations = { ...(x.situations ?? {}), [s.key]: e.target.value }))} />
                <Err issues={issues} at={`/voice/situations/${s.key}`} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <SampleCard voice={v} />
    </div>
  );
}

function Toggle({ label, help, on, onToggle, disabled }: { label: string; help: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  const id = `dir-t-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="dir-toggle">
      <span style={{ flexGrow: 1, minWidth: 0 }}><span className="dir-label" id={id}>{label}</span><span className="help" style={{ display: "block" }}>{help}</span></span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="switch" disabled={disabled} onClick={onToggle}><i /></button>
    </div>
  );
}

function Glossary({ v, setVoice, issues, disabled }: { v: Voice; setVoice: (fn: (v: Voice) => void) => void; issues: SectionProps["issues"]; disabled: boolean }) {
  const rows = v.glossary ?? [];
  const set = (i: number, g: { use: string; insteadOf?: string[] }) => setVoice((x) => void (x.glossary = rows.map((r, j) => (j === i ? g : r))));
  return (
    <div className="field">
      <span className="dir-label">Say this, not that</span>
      {!!rows.length && (
        <table className="dir-glossary">
          <thead><tr><th scope="col">Say</th><th scope="col">Instead of</th><th><span className="sr">Remove</span></th></tr></thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={i}>
                <td>
                  <input className="input" aria-label={`Word ${i + 1} to use`} value={g.use} placeholder="payment" disabled={disabled} onChange={(e) => set(i, { ...g, use: e.target.value })} />
                  <Err issues={issues} at={`/voice/glossary/${i}/use`} />
                </td>
                <td><Words id={`dir-g-${i}`} label={`Instead of for word ${i + 1}`} values={g.insteadOf ?? []} onChange={(w) => set(i, { ...g, insteadOf: w })} placeholder="transaction" disabled={disabled} tone="bad" /></td>
                <td>{!disabled && <button type="button" className="dir-x" aria-label={`Remove “${g.use || `word ${i + 1}`}”`} onClick={() => setVoice((x) => void (x.glossary = rows.filter((_, j) => j !== i)))}>×</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!disabled && <button type="button" className="btn ghost sm dir-add" onClick={() => setVoice((x) => void (x.glossary = [...rows, { use: "", insteadOf: [] }]))}>+ Add a word</button>}
      <Err issues={issues} at="/voice/glossary" />
    </div>
  );
}

/** A heading, a sentence and a button, checked by the spec's checks as a screen's copy is. */
function SampleCard({ voice }: { voice: Voice }) {
  const [sample, setSample] = useState<Sample>(SAMPLE);
  const results = useMemo(() => checkSample({ voice }, sample), [voice, sample]);
  const failing = results.filter((r) => !r.pass);
  const avoided = useMemo(() => avoidedIn({ voice }, `${sample.heading} ${sample.text} ${sample.button}`), [voice, sample]);
  const mark = (text: string): ReactNode => {
    if (!avoided.length || !text) return text;
    const re = new RegExp(`(${avoided.map((a) => a.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
    return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="dir-mark" title={avoided.find((a) => a.term.toLowerCase() === part.toLowerCase())?.suggest ? `Say “${avoided.find((a) => a.term.toLowerCase() === part.toLowerCase())!.suggest}”` : "Never say this"}>{part}</mark> : part));
  };
  return (
    <aside className="card dir-card dir-sample" aria-labelledby="dir-sample">
      <div className="dir-card-head">
        <div style={{ flexGrow: 1 }}>
          <h2 id="dir-sample">Try a sentence</h2>
          <p className="small muted">Checked as you type by the verifier's copy checks, with the settings on the left.</p>
        </div>
        {failing.length ? <span className="tag warn">{failing.length} to fix</span> : <span className="tag ok"><Mark size={18} state="checked" />Passes</span>}
      </div>
      <div className="dir-sample-preview" aria-label="The sample as a screen shows it">
        {sample.heading && <b className="dir-sample-h">{mark(sample.heading)}</b>}
        <p>{mark(sample.text)}</p>
        {sample.button && <span className="dir-sample-btn">{mark(sample.button)}</span>}
      </div>
      <div className="field"><label htmlFor="dir-s-h">Heading</label><input id="dir-s-h" className="input" value={sample.heading} onChange={(e) => setSample({ ...sample, heading: e.target.value })} /></div>
      <div className="field"><label htmlFor="dir-s-t">Sentence</label><textarea id="dir-s-t" className="textarea" rows={3} value={sample.text} onChange={(e) => setSample({ ...sample, text: e.target.value })} /></div>
      <div className="field"><label htmlFor="dir-s-b">Button</label><input id="dir-s-b" className="input" value={sample.button} onChange={(e) => setSample({ ...sample, button: e.target.value })} /></div>
      <ul className="dir-results" aria-label="Checks">
        {results.map((r) => (
          <li key={r.id} data-pass={r.pass}>
            {r.pass ? <Mark size={20} state="checked" /> : <span className="dot warn" aria-hidden="true" />}
            <span style={{ minWidth: 0 }}>
              <span className="sr">{r.pass ? "Passes: " : "Flagged: "}</span>
              <b>{r.description}</b>
              {!r.pass ? <span className="small" style={{ display: "block", color: "var(--warn)" }}>{r.message}</span> : /too little/.test(r.message) ? <span className="small muted" style={{ display: "block" }}>Not measured: under 30 words of running text.</span> : null}
            </span>
          </li>
        ))}
        {!results.length && <li><span className="small muted">Nothing checkable is set yet. Casing, person, spelling, punctuation, label length, reading level and words all become checks.</span></li>}
      </ul>
      <p className="small muted">Tone, guidelines and moments aren't checked here: they go to the generator as guidance.</p>
    </aside>
  );
}
