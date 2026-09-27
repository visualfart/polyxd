import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { RadioGroup } from "radix-ui";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { asList, absolute, childPointer, get } from "../data.ts";
import { formatValue } from "../format.ts";
import { useA11y } from "../surface.tsx";
import { Avatar, Icon } from "./avatar.tsx";
import { IDENTITY_SIZE, STAR_PATH as STAR, contextWithValue, groupSummary, maskSecret, meterHint, ratingSaid, starsLabel as stars } from "@polyxd/core";

type Surface = ReturnType<typeof useSurface>;
type Bindings = ReturnType<typeof useBindings>;

/**
 * Dispatch an input's action with the value it just wrote applied, so context bound to the
 * input's own path carries the new value rather than the one still in host data (as Toggle does).
 */
function dispatchWithValue(s: Surface, b: Bindings, node: Node, next: unknown) {
  if (!node.action) return;
  s.dispatch({ event: { name: node.action.event.name, context: contextWithValue(node, s.data, b.scope, next) } }, { pointer: "" }, node.id);
}

/* ---------------------------------------------------------------- Tag */

/**
 * A short label, status or count. A status is coloured by tone but its label carries the meaning;
 * a count is a number whose label is its accessible name ("Inbox: 12"); a removable tag has a
 * button named "Remove <label>".
 */
export function Tag({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const label = b.text(node.label);
  const kind: string = node.kind ?? "label";
  const tone: string = kind === "status" ? node.tone ?? "neutral" : "neutral";
  const a11y = useA11y(node);
  const cls = `pxd-tag pxd-tag-${kind} pxd-tag-${tone}${node.remove ? " pxd-tag-removable" : ""}`;

  if (kind === "count") {
    const count = b.text(node.count, { type: "number" });
    return (
      <span className={cls} title={label} {...a11y}>
        <span className="pxd-sr-only">{label}: </span>
        <span className="pxd-tag-number">{count}</span>
      </span>
    );
  }
  return (
    <span className={cls} title={label} {...a11y}>
      <span className="pxd-tag-text">{label}</span>
      {node.remove && (
        <button type="button" className="pxd-tag-remove" aria-label={`Remove ${label}`} onClick={() => s.dispatch(node.remove, b.scope, node.id)}>
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}

/* ----------------------------------------------------------- Identity */

/**
 * A person, team or organisation: picture, name and a line of detail; or a group of them as
 * overlapping pictures with "+N" for the rest. With an action, the whole element is one button
 * named by the name.
 */
export function Identity({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const nameId = useId();
  const detailId = useId();
  const a11y = useA11y(node);
  const kind: string = node.kind ?? "person";
  const sizeName: string = node.size ?? "default";
  const size = IDENTITY_SIZE[sizeName] ?? IDENTITY_SIZE.default;
  const name = b.text(node.name);
  const detail = node.detail !== undefined ? b.text(node.detail) : undefined;
  const style = { "--polyxd-identity-size": `${size}px` } as CSSProperties;
  const cls = `pxd-identity pxd-identity-${sizeName} pxd-identity-${kind}${node.group ? " pxd-identity-group" : ""}`;

  let faces: React.ReactNode;
  let summary = name;
  if (node.group) {
    const pointer = absolute(node.group.path, b.scope);
    const members = asList(get(s.data, pointer)).map((_, i) => {
      const scope = { pointer: childPointer(pointer, i) };
      const at = (path?: string) => (path ? get(s.data, absolute(path, scope)) : undefined);
      return { name: String(at(node.group.namePath) ?? ""), image: at(node.group.imagePath) };
    });
    const max: number = node.group.max ?? 4;
    const shown = members.slice(0, max);
    const rest = members.slice(max);
    // The host's summary names the group; without one, list the first names and how many more.
    if (!summary) summary = groupSummary(members, max);
    faces = (
      <span className="pxd-identity-faces">
        {shown.map((m, i) => (
          <span className="pxd-identity-face" key={i}>
            <Avatar value={m.image} name={m.name} size={size} />
            <span className="pxd-sr-only">{m.name}</span>
          </span>
        ))}
        {rest.length > 0 && (
          <span className="pxd-identity-face pxd-identity-more" role="img" title={rest.map((m) => m.name).join(", ")} aria-label={`${rest.length} more: ${rest.map((m) => m.name).join(", ")}`}>
            <span aria-hidden="true">+{rest.length}</span>
          </span>
        )}
      </span>
    );
  } else {
    faces = <Avatar value={b.value(node.image)} name={name} size={size} />;
  }

  const body = (
    <>
      {faces}
      <span className="pxd-identity-text">
        <span className="pxd-identity-name" id={nameId}>
          {summary}
        </span>
        {detail && (
          <span className="pxd-identity-detail" id={detailId}>
            {detail}
          </span>
        )}
      </span>
    </>
  );

  if (node.action) {
    return (
      <button type="button" className={`${cls} pxd-identity-button`} style={style} aria-labelledby={nameId} aria-describedby={detail ? detailId : undefined} onClick={() => s.dispatch(node.action, b.scope, node.id)} {...a11y}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} style={style} role="group" aria-labelledby={nameId} aria-describedby={detail ? detailId : undefined} {...a11y}>
      {body}
    </div>
  );
}

/* ----------------------------------------------------------- Progress */

/**
 * A bar or ring (progress towards done: role progressbar) or a meter (an amount within bounds:
 * role meter, tone by threshold). The readout is text beside the graphic; an indeterminate bar
 * has no value and is busy.
 */
export function Progress({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const a11y = useA11y(node);
  const kind: string = node.kind ?? "bar";
  const label = b.text(node.label);
  const indeterminate = Boolean(b.value(node.indeterminate));
  const rawValue = b.value<unknown>(node.value);
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const rawMax = node.max !== undefined ? Number(b.value(node.max)) : undefined;
  const max = rawMax !== undefined && Number.isFinite(rawMax) && rawMax > 0 ? rawMax : undefined;
  const fraction = Number.isFinite(value) ? Math.max(0, Math.min(1, max !== undefined ? value / max : value)) : 0;
  const readout = node.format ? formatValue(rawValue, resolveFormat(node.format, s.data, b.scope), s.locale) : formatValue(fraction, { type: "percent", precision: 0 }, s.locale);
  const caption = node.caption !== undefined ? b.text(node.caption) : undefined;
  const meter = kind === "meter";
  const byThreshold = meter ? meterHint(fraction, node.thresholds) : {};
  const tone: string | undefined = node.tone ?? byThreshold.tone;
  const hint = meter ? byThreshold.hint : undefined;
  const valuetext = [readout, caption, hint].filter(Boolean).join(", ");
  const percent = Math.round(fraction * 100);

  // Value attributes: the real amount and bound when there is one, otherwise a percentage.
  const valueProps = indeterminate
    ? { "aria-busy": true as const }
    : max !== undefined
      ? { "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": Number.isFinite(value) ? value : 0, "aria-valuetext": valuetext }
      : { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent, "aria-valuetext": valuetext };
  const role = meter ? "meter" : "progressbar";
  const cls = `pxd-gauge pxd-gauge-${kind}${tone && tone !== "neutral" ? ` pxd-gauge-${tone}` : ""}${indeterminate ? " pxd-gauge-indeterminate" : ""}`;

  const text = (
    <div className="pxd-gauge-header">
      <span className="pxd-gauge-label" id={labelId}>
        {label}
      </span>
      <span className="pxd-gauge-readout">
        {!indeterminate && <span className="pxd-gauge-value">{readout}</span>}
        {caption && <span className="pxd-gauge-caption">{caption}</span>}
        {hint && <span className="pxd-gauge-hint">{hint}</span>}
      </span>
    </div>
  );

  if (kind === "ring") {
    return (
      <div className={cls} {...a11y}>
        <div className="pxd-gauge-ring-graphic" role={role} aria-labelledby={labelId} {...valueProps}>
          <svg className="pxd-gauge-ring-svg" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
            <circle className="pxd-gauge-ring-track" cx="18" cy="18" r="16" fill="none" strokeWidth="4" />
            <circle className="pxd-gauge-ring-fill" cx="18" cy="18" r="16" fill="none" strokeWidth="4" pathLength={100} strokeDasharray={indeterminate ? "25 100" : `${percent} 100`} strokeLinecap="round" />
          </svg>
        </div>
        {text}
      </div>
    );
  }
  return (
    <div className={cls} {...a11y}>
      {text}
      <div className="pxd-gauge-track" role={role} aria-labelledby={labelId} {...valueProps}>
        <div className="pxd-gauge-fill" style={indeterminate ? undefined : { width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Rating */

/** One star shape, filled to a fraction (so 4.6 shows a 60% fifth star). */
function Star({ fill }: { fill: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return (
    <span className="pxd-rating-star-shape" aria-hidden="true">
      <svg className="pxd-rating-star-empty" viewBox="0 0 24 24" focusable="false">
        <path d={STAR} />
      </svg>
      <span className="pxd-rating-star-fill" style={{ width: `${pct}%` }}>
        <svg viewBox="0 0 24 24" focusable="false">
          <path d={STAR} />
        </svg>
      </span>
    </span>
  );
}

/**
 * A score out of N. Given by the person: a radiogroup of radios named "1 star" to "N stars",
 * each a real control at the minimum target size. Read-only: an image named "4.6 out of 5" with
 * the score as text beside it.
 */
export function Rating({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const helpId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const a11y = useA11y(node);
  const max: number = node.max ?? 5;
  const label = b.text(node.label);
  const raw = b.value<unknown>(node.value);
  const value = raw === null || raw === undefined || raw === "" ? undefined : Number(raw);
  const score = value !== undefined && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : undefined;
  const readOnly = Boolean(b.value(node.readOnly));
  const count = node.count !== undefined ? b.value<unknown>(node.count) : undefined;
  const countText = count !== undefined && count !== null ? formatValue(count, { type: "number" }, s.locale) : undefined;
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const scoreText = score !== undefined ? formatValue(score, { type: "number", precision: Number.isInteger(score) ? 0 : 1 }, s.locale) : undefined;
  const countSpoken = count !== undefined && count !== null ? `from ${countText} ${Number(count) === 1 ? "rating" : "ratings"}` : undefined;

  if (readOnly) {
    const said = ratingSaid(scoreText, max);
    return (
      <div className="pxd-rating pxd-rating-readonly" {...a11y}>
        <span className="pxd-rating-label">{label}</span>
        <span className="pxd-rating-stars" role="img" aria-label={said}>
          {Array.from({ length: max }, (_, i) => (
            <Star key={i} fill={(score ?? 0) - i} />
          ))}
        </span>
        <span className="pxd-rating-readout">
          {scoreText && (
            <span className="pxd-rating-value" aria-hidden="true">
              {scoreText}
            </span>
          )}
          {countText && (
            <span className="pxd-rating-count">
              <span aria-hidden="true">({countText})</span>
              <span className="pxd-sr-only">{countSpoken}</span>
            </span>
          )}
        </span>
      </div>
    );
  }

  const current = score !== undefined ? Math.round(score) : 0;
  const shown = hover ?? current;
  const rate = (v: string) => {
    const n = Number(v);
    b.write(node.value, n);
    dispatchWithValue(s, b, node, n);
  };
  return (
    <div className="pxd-field pxd-rating" {...a11y}>
      <div className="pxd-field-label" id={labelId}>
        {label}
        {node.required && (
          <span className="pxd-required" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {help && (
        <p className="pxd-field-help" id={helpId}>
          {help}
        </p>
      )}
      <div className="pxd-rating-row">
        <RadioGroup.Root
          className="pxd-rating-stars"
          orientation="horizontal"
          aria-labelledby={labelId}
          aria-describedby={help ? helpId : undefined}
          aria-required={node.required || undefined}
          value={current ? String(current) : ""}
          onValueChange={rate}
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <RadioGroup.Item key={n} value={String(n)} className={`pxd-rating-star${n <= shown ? " pxd-rating-star-on" : ""}`} aria-label={stars(n)} onMouseEnter={() => setHover(n)} onFocus={() => setHover(null)}>
              <Star fill={n <= shown ? 1 : 0} />
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        <span className="pxd-rating-readout" aria-hidden="true">
          {scoreText && <span className="pxd-rating-value">{scoreText}</span>}
          {countText && <span className="pxd-rating-count">({countText})</span>}
        </span>
        {countSpoken && <span className="pxd-sr-only">{countSpoken}</span>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Code */

const COPIED_FOR = 2000;

/**
 * Code, a command or preformatted text: a region named by its label holding pre > code, with a
 * Copy button that announces "Copied". A secret is masked to the same length until shown.
 */
export function Code({ node }: { node: Node }) {
  const b = useBindings();
  const labelId = useId();
  const a11y = useA11y(node);
  const text = b.text(node.text);
  const label = node.label !== undefined ? b.text(node.label) : undefined;
  const secret = Boolean(b.value(node.secret));
  const copyable = node.copyable !== false;
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<"" | "Copied" | "Couldn't copy">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const announce = (next: "Copied" | "Couldn't copy") => {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(""), COPIED_FOR);
  };
  const copy = () => {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) return announce("Couldn't copy");
    clipboard.writeText(text).then(() => announce("Copied"), () => announce("Couldn't copy"));
  };

  const masked = secret && !revealed;
  const shown = masked ? maskSecret(text) : text;
  const what = label ?? "code";
  const name = label ?? (node.language ? `${node.language} code` : "Code");
  return (
    <section className={`pxd-code${node.wrap ? " pxd-code-wrap" : ""}${secret ? " pxd-code-secret" : ""}`} aria-labelledby={label !== undefined ? labelId : undefined} aria-label={label === undefined ? name : undefined} {...a11y}>
      <div className="pxd-code-header">
        {label !== undefined && (
          <span className="pxd-code-label" id={labelId}>
            {label}
          </span>
        )}
        <div className="pxd-code-controls">
          {secret && (
            <button type="button" className="pxd-button pxd-button-tertiary pxd-code-control" aria-label={`${revealed ? "Hide" : "Show"} ${what}`} onClick={() => setRevealed((r) => !r)}>
              {revealed ? "Hide" : "Show"}
            </button>
          )}
          {copyable && (
            <button type="button" className="pxd-button pxd-button-tertiary pxd-code-control" aria-label={`Copy ${what}`} onClick={copy}>
              {status === "Copied" && <Icon name="check" size={16} />}
              {status === "Copied" ? "Copied" : "Copy"}
            </button>
          )}
          <span className="pxd-sr-only" role="status" aria-live="polite">
            {status}
          </span>
        </div>
      </div>
      <pre className="pxd-code-pre" tabIndex={0} data-language={node.language} data-masked={masked || undefined}>
        <code className={node.language ? `language-${node.language}` : undefined} translate="no">
          {shown}
        </code>
      </pre>
    </section>
  );
}
