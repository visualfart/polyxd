/**
 * The Direction's details (version, design system) and its profile: each setting as cards with a
 * small drawing of what it does, the schema's default marked while nothing is chosen.
 */
import { EMPHASIS, PROFILE_FIELDS, type ProfileField } from "../../direction/labels.ts";
import { Card, Err, type SectionProps } from "./common.tsx";

export function ProfileSection({ snap, update, issues, canEdit, designSystems, keyName }: SectionProps & { designSystems: string[]; keyName: string }) {
  const d = snap.direction;
  const profile = (d.profile ?? {}) as Record<string, unknown>;
  const set = (key: string, value: unknown) => update((s) => {
    s.direction.profile = { ...(s.direction.profile ?? {}), [key]: value };
  });
  const unset = (key: string) => update((s) => {
    const p = { ...(s.direction.profile ?? {}) } as Record<string, unknown>;
    delete p[key];
    s.direction.profile = p;
  });
  const budget = (profile.emphasisBudget as number | undefined) ?? EMPHASIS.default;
  return (
    <div className="dir-stack">
      <Card title="About this Direction" lede="What products read to know which Direction they have. The key is the Direction's name in the file." id="dir-details">
        <div className="dir-row">
          <div className="field" style={{ flex: "1 1 160px" }}>
            <label htmlFor="dir-version">Version</label>
            <input id="dir-version" className="input mono" value={d.version ?? ""} disabled={!canEdit} aria-invalid={!!issues.find((i) => i.at === "/version")} onChange={(e) => update((s) => void (s.direction.version = e.target.value))} placeholder="1.0.0" />
            <span className="help">Your own numbering, e.g. 1.2.0. Saving suggests the next one.</span>
            <Err issues={issues} at="/version" />
          </div>
          <div className="field" style={{ flex: "2 1 240px" }}>
            <label htmlFor="dir-ds">Design system</label>
            <input id="dir-ds" className="input" list="dir-ds-list" value={d.designSystem ?? ""} disabled={!canEdit} onChange={(e) => update((s) => void (s.direction.designSystem = e.target.value))} placeholder="material3" />
            <datalist id="dir-ds-list">{designSystems.map((n) => <option key={n} value={n} />)}</datalist>
            <span className="help">The pack it goes with. Tokens live there; taste lives here.</span>
            <Err issues={issues} at="/designSystem" />
          </div>
          <div className="field" style={{ flex: "1 1 160px" }}>
            <span className="dir-label">Key</span>
            <span className="input mono dir-readonly">{keyName}</span>
            <span className="help">Change it from Details.</span>
          </div>
        </div>
      </Card>
      <Card title="Profile" lede="How screens are put together. Generators follow these; the verifier holds them to the emphasis budget." id="dir-profile">
        <Err issues={issues} at="/profile" />
        {PROFILE_FIELDS.map((f) => (
          <ProfileChoice key={f.key} field={f} value={profile[f.key] as string | undefined} onPick={(v) => set(f.key, v)} onReset={() => unset(f.key)} canEdit={canEdit} issues={issues} />
        ))}
        <div className="dir-field">
          <div className="dir-field-head">
            <span className="dir-label" id="dir-emphasis">{EMPHASIS.label}{profile.emphasisBudget === undefined && <span className="tag" style={{ marginLeft: 8, height: 22 }}>default</span>}</span>
            <span className="help">{EMPHASIS.help}</span>
          </div>
          <div className="dir-options" role="radiogroup" aria-labelledby="dir-emphasis">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={budget === n} className="choice-card dir-option" data-on={budget === n} disabled={!canEdit} onClick={() => set("emphasisBudget", n)}>
                <Glyph kind={`emphasis:${n}`} />
                <b>{n === 1 ? "One" : n === 2 ? "Two" : "Three"}</b>
                <span>{n === 1 ? "One main thing to do." : `Up to ${n} actions in the strongest style.`}</span>
              </button>
            ))}
          </div>
          <Err issues={issues} at="/profile/emphasisBudget" />
        </div>
      </Card>
    </div>
  );
}

function ProfileChoice({ field, value, onPick, onReset, canEdit, issues }: { field: ProfileField; value: string | undefined; onPick: (v: string) => void; onReset: () => void; canEdit: boolean; issues: SectionProps["issues"] }) {
  const current = value ?? field.default;
  const id = `dir-${field.key}`;
  return (
    <div className="dir-field">
      <div className="dir-field-head">
        <span className="dir-label" id={id}>
          {field.label}
          {value === undefined ? <span className="tag" style={{ marginLeft: 8, height: 22 }}>default</span> : value !== field.default && canEdit ? <button type="button" className="dir-link" onClick={onReset}>Use the default</button> : null}
        </span>
        <span className="help">{field.help}</span>
      </div>
      <div className="dir-options" role="radiogroup" aria-labelledby={id}>
        {field.options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={current === o.value} className="choice-card dir-option" data-on={current === o.value} disabled={!canEdit} onClick={() => onPick(o.value)}>
            <Glyph kind={`${field.key}:${o.value}`} />
            <b>{o.label}{o.value === field.default && <span className="dir-default"> · default</span>}</b>
            <span>{o.help}</span>
          </button>
        ))}
      </div>
      <Err issues={issues} at={`/profile/${field.key}`} />
    </div>
  );
}

/** A small drawing of what a choice does, in ink on the card; the chosen one gets the signal. */
export function Glyph({ kind }: { kind: string }) {
  const W = 64;
  const H = 40;
  const ink = "currentColor";
  const rows = (gap: number, n: number) => Array.from({ length: n }, (_, i) => <rect key={i} x={6} y={4 + i * gap} width={52} height={Math.max(3, gap - 5)} rx={2} fill={ink} opacity={0.18 + (i === 0 ? 0.5 : 0)} />);
  let body;
  switch (kind) {
    case "density:compact": body = rows(7, 5); break;
    case "density:comfortable": body = rows(9, 4); break;
    case "density:spacious": body = rows(12, 3); break;
    case "dataDisplay:auto": body = <><rect x={6} y={22} width={8} height={14} rx={1.5} fill={ink} opacity={0.5} /><rect x={17} y={14} width={8} height={22} rx={1.5} fill={ink} opacity={0.5} /><line x1={32} y1={10} x2={58} y2={10} stroke={ink} strokeWidth={2} opacity={0.4} /><line x1={32} y1={18} x2={58} y2={18} stroke={ink} strokeWidth={2} opacity={0.4} /><text x={32} y={36} fontSize={13} fontWeight={700} fill={ink} fontFamily="var(--body)">42</text></>; break;
    case "dataDisplay:prefer-charts": body = <><polyline points="6,32 18,24 28,28 40,14 52,18 58,8" fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /><line x1={6} y1={36} x2={58} y2={36} stroke={ink} strokeWidth={1} opacity={0.3} /></>; break;
    case "dataDisplay:prefer-tables": body = <>{[6, 15, 24, 33].map((y, i) => <g key={y}><rect x={6} y={y} width={20} height={4} rx={1} fill={ink} opacity={i ? 0.3 : 0.7} /><rect x={30} y={y} width={12} height={4} rx={1} fill={ink} opacity={i ? 0.3 : 0.7} /><rect x={46} y={y} width={12} height={4} rx={1} fill={ink} opacity={i ? 0.3 : 0.7} /></g>)}</>; break;
    case "dataDisplay:prefer-metrics": body = <><text x={6} y={26} fontSize={20} fontWeight={700} fill={ink} fontFamily="var(--body)">£42</text><rect x={6} y={31} width={30} height={4} rx={1} fill={ink} opacity={0.3} /></>; break;
    case "motion:none": body = <rect x={24} y={12} width={16} height={16} rx={3} fill={ink} opacity={0.7} />; break;
    case "motion:subtle": body = <><rect x={16} y={12} width={16} height={16} rx={3} fill={ink} opacity={0.15} /><rect x={28} y={12} width={16} height={16} rx={3} fill={ink} opacity={0.7} /></>; break;
    case "motion:expressive": body = <><path d="M8 32 Q24 2 44 20" fill="none" stroke={ink} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.5} /><rect x={8} y={26} width={10} height={10} rx={2} fill={ink} opacity={0.15} /><rect x={42} y={10} width={16} height={16} rx={3} fill={ink} opacity={0.7} transform="rotate(12 50 18)" /></>; break;
    case "disclosure:progressive": body = <><rect x={6} y={6} width={52} height={10} rx={2} fill={ink} opacity={0.6} /><path d="M9 25 l4 4 l4 -4" fill="none" stroke={ink} strokeWidth={2} /><rect x={22} y={24} width={30} height={4} rx={1} fill={ink} opacity={0.35} /></>; break;
    case "disclosure:show-everything": body = <><rect x={6} y={4} width={52} height={8} rx={2} fill={ink} opacity={0.6} /><path d="M9 17 l4 4 l4 -4" fill="none" stroke={ink} strokeWidth={2} transform="rotate(180 13 19)" /><rect x={22} y={17} width={30} height={4} rx={1} fill={ink} opacity={0.35} /><rect x={22} y={25} width={36} height={4} rx={1} fill={ink} opacity={0.35} /><rect x={22} y={33} width={26} height={4} rx={1} fill={ink} opacity={0.35} /></>; break;
    case "freedom:strict": body = <><line x1={14} y1={4} x2={14} y2={36} stroke={ink} strokeWidth={1.5} opacity={0.4} /><line x1={50} y1={4} x2={50} y2={36} stroke={ink} strokeWidth={1.5} opacity={0.4} /><line x1={32} y1={6} x2={32} y2={34} stroke={ink} strokeWidth={2.5} strokeLinecap="round" /></>; break;
    case "freedom:guided": body = <><line x1={10} y1={4} x2={10} y2={36} stroke={ink} strokeWidth={1.5} opacity={0.4} /><line x1={54} y1={4} x2={54} y2={36} stroke={ink} strokeWidth={1.5} opacity={0.4} /><path d="M32 6 C18 14 46 24 30 34" fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" /></>; break;
    case "freedom:open": body = <path d="M12 30 C20 4 30 38 40 14 S56 20 54 8" fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" />; break;
    default: {
      const n = Number(kind.split(":")[1] ?? 1);
      body = <>{Array.from({ length: 3 }, (_, i) => <rect key={i} x={4 + i * 20} y={14} width={17} height={12} rx={6} fill={ink} opacity={i < n ? 0.75 : 0.15} />)}</>;
    }
  }
  return <svg className="dir-glyph" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">{body}</svg>;
}
