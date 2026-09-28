/**
 * Patterns: the spec's six, each preferred, left to the generator, or ruled out; and the team's
 * own, written as the spec writes its patterns (the situations it's for, guidance, the components
 * it prefers in reading order), which the Direction lists as files of its own.
 */
import { useState } from "react";
import { CORE_PATTERNS, blankPattern, type CompanyPattern } from "../../direction/model.ts";
import { Card, Err, Lines, type Issue, type SectionProps } from "./common.tsx";

type Stance = "prefer" | "neutral" | "disallow";
const STANCES: { value: Stance; label: string }[] = [{ value: "prefer", label: "Prefer" }, { value: "neutral", label: "Either" }, { value: "disallow", label: "Avoid" }];

export function PatternsSection({ snap, update, issues, canEdit, components }: SectionProps & { components: string[] }) {
  const [open, setOpen] = useState<{ pattern: CompanyPattern; index: number | null } | null>(null);
  const p = snap.direction.patterns ?? {};
  const stanceOf = (id: string): Stance => (p.prefer?.includes(id) ? "prefer" : p.disallow?.includes(id) ? "disallow" : "neutral");
  const setStance = (id: string, stance: Stance) => update((s) => {
    const cur = s.direction.patterns ?? {};
    const prefer = (cur.prefer ?? []).filter((x) => x !== id);
    const disallow = (cur.disallow ?? []).filter((x) => x !== id);
    if (stance === "prefer") prefer.push(id);
    if (stance === "disallow") disallow.push(id);
    s.direction.patterns = { ...cur, prefer, disallow };
  });
  const remove = (i: number) => update((s) => {
    const id = s.patterns[i].id;
    s.patterns = s.patterns.filter((_, j) => j !== i);
    const cur = s.direction.patterns ?? {};
    s.direction.patterns = { ...cur, prefer: (cur.prefer ?? []).filter((x) => x !== id), disallow: (cur.disallow ?? []).filter((x) => x !== id) };
  });
  const save = () => {
    if (!open) return;
    update((s) => {
      if (open.index === null) s.patterns = [...s.patterns, open.pattern];
      else s.patterns = s.patterns.map((x, j) => (j === open.index ? open.pattern : x));
    });
    setOpen(null);
  };
  const external = p.custom ?? [];
  const patternIssues = (id: string) => issues.filter((i) => i.pattern === id);
  return (
    <div className="dir-stack">
      <Card title="Polyxd's patterns" lede="The arrangements the spec ships for common tasks. Prefer the ones your product leans on; rule out the ones it shouldn't use." id="dir-core">
        <ul className="dir-patterns">
          {CORE_PATTERNS.map((c) => (
            <li key={c.id}>
              <span style={{ flexGrow: 1, minWidth: 0 }}>
                <b>{c.name}</b>
                <span className="small muted" style={{ display: "block" }}>{c.summary}</span>
              </span>
              <Stances id={c.id} name={c.name} value={stanceOf(c.id)} onChange={(v) => setStance(c.id, v)} disabled={!canEdit} />
            </li>
          ))}
        </ul>
        <Err issues={issues} at="/patterns/prefer" under />
        <Err issues={issues} at="/patterns/disallow" under />
      </Card>

      <Card title="Your patterns" lede="Situations your product meets often, and how you'd handle them: what it's for, the guidance, and the components you prefer, in reading order. Yours take precedence over the spec's." id="dir-own"
        aside={canEdit && <button type="button" className="btn sm" onClick={() => setOpen({ pattern: blankPattern("", snap.patterns.map((x) => x.id)), index: null })}>New pattern</button>}>
        {!snap.patterns.length && <p className="small muted">None yet. A pattern here is a file of the Direction's own, in the same format as the spec's six.</p>}
        <ul className="dir-patterns">
          {snap.patterns.map((cp, i) => {
            const bad = patternIssues(cp.id);
            return (
              <li key={cp.id + i}>
                <span style={{ flexGrow: 1, minWidth: 0 }}>
                  <b>{cp.name || <span className="muted">Unnamed</span>}</b> <span className="mono small muted">{cp.id}</span>
                  {cp.summary && <span className="small muted" style={{ display: "block" }}>{cp.summary}</span>}
                  <span className="dir-pattern-meta">
                    {cp.whenToUse.map((w) => <span key={w} className="tag">{w}</span>)}
                    {!!cp.structure.length && <span className="small">{cp.structure.map((s, j) => <span key={j}>{j > 0 && <span className="muted"> → </span>}<span className="mono">{s}</span></span>)}</span>}
                  </span>
                  {!!bad.length && <span className="err" style={{ display: "block" }}>{bad[0].message}{bad.length > 1 ? ` (and ${bad.length - 1} more)` : ""}</span>}
                </span>
                <Stances id={cp.id} name={cp.name} value={stanceOf(cp.id)} onChange={(v) => setStance(cp.id, v)} disabled={!canEdit} />
                {canEdit && <button type="button" className="btn ghost sm" onClick={() => setOpen({ pattern: structuredClone(cp), index: i })}>Edit</button>}
                {canEdit && <button type="button" className="btn ghost sm" onClick={() => remove(i)} aria-label={`Remove ${cp.name || cp.id}`}>Remove</button>}
              </li>
            );
          })}
        </ul>
      </Card>

      {!!external.length && (
        <Card title="Pattern files kept as paths" lede="Listed in the file you imported. Studio doesn't have them, so they stay as the paths they were; a generator reading this Direction looks for them there." id="dir-external">
          <ul className="dir-patterns">
            {external.map((path) => (
              <li key={path}>
                <span className="mono small" style={{ flexGrow: 1, overflowWrap: "anywhere" }}>{path}</span>
                {canEdit && <button type="button" className="btn ghost sm" onClick={() => update((s) => void (s.direction.patterns = { ...(s.direction.patterns ?? {}), custom: external.filter((x) => x !== path) }))}>Remove</button>}
              </li>
            ))}
          </ul>
          <Err issues={issues} at="/patterns/custom" under />
        </Card>
      )}

      {open && <PatternDrawer open={open.pattern} isNew={open.index === null} taken={snap.patterns.filter((_, j) => j !== open.index).map((x) => x.id)} components={components} onChange={(pattern) => setOpen({ ...open, pattern })} onClose={() => setOpen(null)} onSave={save} issues={open.index === null ? [] : patternIssues(open.pattern.id)} />}
    </div>
  );
}

function Stances({ id, name, value, onChange, disabled }: { id: string; name: string; value: Stance; onChange: (s: Stance) => void; disabled: boolean }) {
  return (
    <div className="segmented dir-seg" role="radiogroup" aria-label={`${name || id}: prefer, either or avoid`}>
      {STANCES.map((s) => <button key={s.value} type="button" role="radio" aria-checked={value === s.value} aria-pressed={value === s.value} disabled={disabled} onClick={() => onChange(s.value)}>{s.label}</button>)}
    </div>
  );
}

function PatternDrawer({ open, isNew, taken, components, onChange, onClose, onSave, issues }: { open: CompanyPattern; isNew: boolean; taken: string[]; components: string[]; onChange: (p: CompanyPattern) => void; onClose: () => void; onSave: () => void; issues: Issue[] }) {
  const [pick, setPick] = useState("");
  const setName = (name: string) => onChange(isNew ? { ...open, name, id: blankPattern(name || "pattern", taken).id } : { ...open, name });
  const at = (p: string) => issues.filter((i) => i.at === p || i.at.startsWith(`${p}/`));
  const problems = [!open.name.trim() && "Give it a name.", !open.summary.trim() && "Say how to handle it.", !open.structure.length && "Pick at least one component."].filter(Boolean) as string[];
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label={isNew ? "New pattern" : `Edit ${open.name}`} style={{ width: 600 }}>
        <header><h2>{isNew ? "New pattern" : open.name || "Pattern"}</h2><button type="button" className="btn ghost sm" onClick={onClose}>Close</button></header>
        <div className="body">
          <div className="field">
            <label htmlFor="pat-name">Name</label>
            <input id="pat-name" className="input" value={open.name} placeholder="Refund a payment" onChange={(e) => setName(e.target.value)} autoFocus />
            <span className="help">Its file is <span className="mono">{open.id || "…"}.json</span>{isNew ? "" : "; the id stays as it is so links to it keep working"}.</span>
            {at("/name").map((i) => <span key={i.message} className="err">{i.message}</span>)}
          </div>
          <Lines label="When to use it" values={open.whenToUse} onChange={(whenToUse) => onChange({ ...open, whenToUse })} placeholder="payments.refund, or: someone asks for their money back" issues={[]} at="/whenToUse" addLabel="Add a situation" />
          <div className="field">
            <label htmlFor="pat-summary">How to handle it</label>
            <textarea id="pat-summary" className="textarea" rows={3} value={open.summary} placeholder="Show what comes back, to where, and by when, before the one button that does it." onChange={(e) => onChange({ ...open, summary: e.target.value })} />
            <span className="help">The guidance a generator reads.</span>
          </div>
          <div className="field">
            <span className="dir-label" id="pat-structure">Preferred components, in reading order</span>
            <ol className="dir-structure" aria-labelledby="pat-structure">
              {open.structure.map((c, i) => (
                <li key={i}>
                  <span className="mono">{c}</span>
                  <span style={{ marginLeft: "auto", display: "inline-flex" }}>
                    <button type="button" className="dir-x" aria-label={`Move ${c} up`} disabled={i === 0} onClick={() => { const s = [...open.structure]; [s[i - 1], s[i]] = [s[i], s[i - 1]]; onChange({ ...open, structure: s }); }}>↑</button>
                    <button type="button" className="dir-x" aria-label={`Move ${c} down`} disabled={i === open.structure.length - 1} onClick={() => { const s = [...open.structure]; [s[i + 1], s[i]] = [s[i], s[i + 1]]; onChange({ ...open, structure: s }); }}>↓</button>
                    <button type="button" className="dir-x" aria-label={`Remove ${c}`} onClick={() => onChange({ ...open, structure: open.structure.filter((_, j) => j !== i) })}>×</button>
                  </span>
                </li>
              ))}
            </ol>
            <div className="dir-row" style={{ gap: 8 }}>
              <select className="select" aria-label="Component to add" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
                <option value="">Choose a component…</option>
                {components.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button type="button" className="btn sm" disabled={!pick} onClick={() => { onChange({ ...open, structure: [...open.structure, pick] }); setPick(""); }}>Add</button>
            </div>
            <span className="help">Only the components generators may use are listed (Components tab).</span>
          </div>
          <div className="dir-row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pat-goal">What the person is trying to do</label>
              <input id="pat-goal" className="input" value={open.journey.goal} placeholder="Get money back for a payment" onChange={(e) => onChange({ ...open, journey: { ...open.journey, goal: e.target.value } })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pat-done">Done when</label>
              <input id="pat-done" className="input" value={open.journey.done} placeholder="The refund is confirmed" onChange={(e) => onChange({ ...open, journey: { ...open.journey, done: e.target.value } })} />
            </div>
          </div>
          <Lines label="Not for" values={open.whenNotToUse ?? []} onChange={(whenNotToUse) => onChange({ ...open, whenNotToUse })} placeholder="Partial refunds: use review-and-submit" issues={[]} at="/whenNotToUse" addLabel="Add a case" />
          {issues.filter((i) => !["/name"].includes(i.at)).map((i) => <span key={i.at + i.message} className="err">{i.message}</span>)}
        </div>
        <footer>
          {problems.length > 0 && <span className="small muted" style={{ marginRight: "auto", alignSelf: "center" }}>{problems[0]}</span>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={problems.length > 0} onClick={onSave}>{isNew ? "Add pattern" : "Done"}</button>
        </footer>
      </div>
    </>
  );
}
