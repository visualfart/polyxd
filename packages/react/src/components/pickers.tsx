import { useId, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { RadioGroup } from "radix-ui";
import { useBindings, useSurface, type Node, type SurfaceContextValue } from "../context.tsx";
import { clamp, colorPlaceholder, contextWithValue, fileLimits, formatBytes, formatColor, parseColor, refuseFile, sameColor, toHex6, type ColorFormat, type RGBA } from "@polyxd/core";
import { useA11y } from "../surface.tsx";
import { optionsOf } from "@polyxd/core";
import { Icon } from "./avatar.tsx";

/*
 * Pickers: files, colours and one-time codes. Each follows the input conventions in inputs.tsx:
 * a `pxd-field` with a `pxd-field-label`, optional `pxd-field-help`, the required mark, and the
 * value written back through the node's binding.
 */

/** Same as inputs.tsx's mark: for the eye only, the control carries `required` for the reader. */
const RequiredMark = () => (
  <span className="pxd-required" aria-hidden="true">
    *
  </span>
);

type Bindings = ReturnType<typeof useBindings>;

/** Dispatch `node.action` with `next` applied wherever its context binds to `node.value` (as Toggle does). */
function dispatchWith(s: SurfaceContextValue, b: Bindings, node: Node, next: unknown) {
  s.dispatch({ event: { name: node.action.event.name, context: contextWithValue(node, s.data, b.scope, next) } }, { pointer: "" }, node.id);
}

const describedBy = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

/* ------------------------------------------------------------------------------------------ */
/* FileInput                                                                                   */
/* ------------------------------------------------------------------------------------------ */

interface FileRef {
  name: string;
  size: number;
  type: string;
  /** An object URL the host reads and uploads from. */
  ref: string;
  /** 0–1 while the host uploads, if it reports it. */
  progress?: number;
}

const revoke = (f: FileRef) => {
  if (typeof f.ref === "string" && f.ref.startsWith("blob:")) URL.revokeObjectURL(f.ref);
};

export function FileInput({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const id = useId();
  const helpId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const raw = b.value<unknown>(node.value);
  const files: FileRef[] = Array.isArray(raw) ? raw : [];
  const accept: string[] = Array.isArray(node.accept) ? node.accept : [];
  const maxSize: number | undefined = node.maxSize;
  const multiple = Boolean(node.multiple);
  const label = b.text(node.label);

  // The limits are always said before choosing, after whatever the host says about what to attach.
  const limits = fileLimits(accept, maxSize, multiple, s.locale);
  const help = [node.help !== undefined ? b.text(node.help) : "", limits].filter(Boolean).join(" ") || undefined;

  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const chosen = Array.from(list);
    const accepted: FileRef[] = [];
    const refused: string[] = [];
    for (const f of multiple ? chosen : chosen.slice(0, 1)) {
      const why = refuseFile(f, accept, maxSize, s.locale);
      if (why) refused.push(why);
      else accepted.push({ name: f.name, size: f.size, type: f.type, ref: URL.createObjectURL(f) });
    }
    setError(refused.length ? refused.join(" ") : null);
    if (accepted.length === 0) return;
    if (multiple) {
      // The same file chosen twice is one file.
      const fresh = accepted.filter((a) => !files.some((f) => f.name === a.name && f.size === a.size));
      accepted.filter((a) => !fresh.includes(a)).forEach(revoke);
      if (fresh.length) b.write(node.value, [...files, ...fresh]);
    } else {
      files.forEach(revoke);
      b.write(node.value, accepted);
    }
  };
  const remove = (i: number) => {
    revoke(files[i]);
    b.write(node.value, files.filter((_, j) => j !== i));
    setError(null);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Leaving a child still counts as inside the zone.
    if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) setDragging(false);
  };

  return (
    <div className="pxd-field pxd-file">
      <label className="pxd-field-label" htmlFor={id}>
        {label}
        {node.required && <RequiredMark />}
      </label>
      {help && (
        <p className="pxd-field-help" id={helpId}>
          {help}
        </p>
      )}
      <div className="pxd-dropzone" data-dragging={dragging || undefined} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
        {/* The input is the real control: it covers the zone, so a click anywhere opens the chooser and the keyboard reaches it as usual. */}
        <input
          id={id}
          className="pxd-dropzone-input"
          type="file"
          accept={accept.length ? accept.join(",") : undefined}
          multiple={multiple}
          required={node.required && files.length === 0}
          aria-describedby={describedBy(help && helpId, error && errorId)}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
          {...useA11y(node)}
        />
        <span className="pxd-dropzone-icon" aria-hidden="true">
          <Icon name="file" size={24} />
        </span>
        <span className="pxd-dropzone-text">
          <span className="pxd-dropzone-action">{multiple ? "Choose files" : "Choose a file"}</span>
          <span className="pxd-dropzone-hint">{multiple ? "or drop them here" : "or drop it here"}</span>
        </span>
      </div>
      {error && (
        <p className="pxd-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="pxd-file-list">
          {files.map((f, i) => (
            <li className="pxd-file-item" key={`${f.name}-${f.size}-${i}`}>
              <span className="pxd-file-icon" aria-hidden="true">
                <Icon name="file" size={18} />
              </span>
              <span className="pxd-file-text">
                <span className="pxd-file-name">{f.name}</span>
                <span className="pxd-file-size">{formatBytes(f.size, s.locale)}</span>
                {typeof f.progress === "number" && f.progress < 1 && <progress className="pxd-file-progress" value={f.progress} max={1} aria-label={`Uploading ${f.name}`} />}
              </span>
              <button type="button" className="pxd-file-remove" aria-label={`Remove ${f.name}`} onClick={() => remove(i)}>
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* ColorInput                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const OTHER = "__other";

export function ColorInput({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const helpId = useId();
  const pickerId = useId();
  const textId = useId();
  const alphaId = useId();
  const format: ColorFormat = node.format ?? "hex";
  const alpha = Boolean(node.alpha);
  const label = b.text(node.label);
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const stored = b.value<unknown>(node.value);
  const storedText = stored === null || stored === undefined ? "" : String(stored);
  const parsed = parseColor(storedText);
  const [draft, setDraft] = useState<string | null>(null);
  const [otherChosen, setOtherChosen] = useState(false);
  const a11y = useA11y(node);
  const swatches = node.swatches ? optionsOf({ ...node, options: node.swatches }, s.data, b.scope, b.text) : [];
  const hasSwatches = swatches.length > 0;

  const write = (c: RGBA) => b.write(node.value, formatColor(c, format, alpha));
  const onText = (text: string) => {
    setDraft(text);
    const c = parseColor(text);
    if (c) write(c);
  };
  // Which swatch holds the current value (by colour, not by text: '#FFF' is 'rgb(255, 255, 255)').
  const matchIdx = swatches.findIndex((o) => (parsed ? sameColor(parseColor(o.value), parsed, alpha) : String(o.value) === storedText && storedText !== ""));
  const current = otherChosen ? OTHER : matchIdx >= 0 ? String(matchIdx) : storedText ? OTHER : "";
  const showPicker = !hasSwatches || current === OTHER;

  const picker = (
    <div className="pxd-color-picker">
      <input
        id={pickerId}
        className="pxd-color-native"
        type="color"
        value={toHex6(parsed)}
        aria-label={`${label}: pick`}
        aria-describedby={describedBy(help && helpId)}
        onChange={(e) => {
          const c = parseColor(e.target.value);
          if (c) {
            setDraft(null);
            write({ ...c, a: parsed?.a ?? 1 });
          }
        }}
      />
      <input
        id={textId}
        className="pxd-input pxd-input-mono pxd-color-text"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        placeholder={colorPlaceholder(format)}
        value={draft ?? storedText}
        aria-label={`${label}: value`}
        aria-describedby={describedBy(help && helpId)}
        aria-invalid={draft !== null && draft !== "" && !parseColor(draft) ? true : undefined}
        required={!hasSwatches && node.required}
        onChange={(e) => onText(e.target.value)}
        onBlur={() => setDraft(null)}
      />
      {alpha && (
        <label className="pxd-color-alpha" htmlFor={alphaId}>
          <span className="pxd-color-alpha-label">Opacity</span>
          <input
            id={alphaId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round((parsed?.a ?? 1) * 100)}
            disabled={!parsed}
            aria-valuetext={`${Math.round((parsed?.a ?? 1) * 100)}%`}
            onChange={(e) => {
              if (parsed) {
                setDraft(null);
                write({ ...parsed, a: Number(e.target.value) / 100 });
              }
            }}
          />
          <output className="pxd-color-alpha-value" htmlFor={alphaId} aria-hidden="true">
            {Math.round((parsed?.a ?? 1) * 100)}%
          </output>
        </label>
      )}
    </div>
  );

  if (!hasSwatches) {
    return (
      <div className="pxd-field pxd-color" role="group" aria-labelledby={labelId} aria-describedby={describedBy(help && helpId)} {...a11y}>
        <div className="pxd-field-label" id={labelId}>
          {label}
          {node.required && <RequiredMark />}
        </div>
        {help && (
          <p className="pxd-field-help" id={helpId}>
            {help}
          </p>
        )}
        {picker}
      </div>
    );
  }

  return (
    <div className="pxd-field pxd-color" {...a11y}>
      <div className="pxd-field-label" id={labelId}>
        {label}
        {node.required && <RequiredMark />}
      </div>
      {help && (
        <p className="pxd-field-help" id={helpId}>
          {help}
        </p>
      )}
      <RadioGroup.Root
        className="pxd-swatches"
        aria-labelledby={labelId}
        aria-describedby={describedBy(help && helpId)}
        aria-required={node.required || undefined}
        value={current}
        orientation="horizontal"
        onValueChange={(k) => {
          if (k === OTHER) return setOtherChosen(true);
          setOtherChosen(false);
          setDraft(null);
          const o = swatches[Number(k)];
          const c = parseColor(o.value);
          b.write(node.value, c ? formatColor(c, format, alpha) : o.value);
        }}
      >
        {swatches.map((o, i) => (
          <RadioGroup.Item key={String(i)} value={String(i)} className="pxd-swatch" title={o.label}>
            <span className="pxd-swatch-color" style={{ background: String(o.value) }} aria-hidden="true" />
            <span className="pxd-swatch-name">{o.label}</span>
          </RadioGroup.Item>
        ))}
        <RadioGroup.Item value={OTHER} className="pxd-swatch pxd-swatch-other" title="Other">
          <span className="pxd-swatch-color" style={current === OTHER && parsed ? { background: storedText } : undefined} aria-hidden="true" />
          <span className="pxd-swatch-name">Other</span>
        </RadioGroup.Item>
      </RadioGroup.Root>
      {showPicker && picker}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* CodeInput                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const fromString = (text: string, n: number): string[] => Array.from({ length: n }, (_, i) => text[i] ?? "");

export function CodeInput({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const helpId = useId();
  const n = clamp(Number(node.length) || 6, 4, 12);
  const numeric = (node.kind ?? "numeric") === "numeric";
  const required = node.required ?? true;
  const label = b.text(node.label);
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const raw = b.value<unknown>(node.value);
  const stored = raw === null || raw === undefined ? "" : String(raw);
  const [chars, setChars] = useState<string[]>(() => fromString(stored, n));
  const [seen, setSeen] = useState(stored);
  // The host may reset or fill the code (e.g. after a failed attempt); follow it.
  if (stored !== seen) {
    setSeen(stored);
    if (stored !== chars.join("")) setChars(fromString(stored, n));
  }
  const [fired, setFired] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const a11y = useA11y(node);

  const clean = (t: string) => t.replace(numeric ? /[^0-9]/g : /[^0-9a-zA-Z]/g, "");
  const focusAt = (i: number) => boxes.current[clamp(i, 0, n - 1)]?.focus();
  const commit = (next: string[]) => {
    setChars(next);
    const code = next.join("");
    setSeen(code);
    b.write(node.value, code);
    if (node.action && next.every(Boolean) && code !== fired) {
      // Every box is in: run the action once for this code, so no button is needed.
      setFired(code);
      dispatchWith(s, b, node, code);
    }
  };
  /** Put `text` into the boxes from `from` onwards, then move to the box after the last one filled. */
  const fill = (from: number, text: string) => {
    const t = clean(text);
    if (!t) return;
    const next = [...chars];
    let i = from;
    for (const ch of t) {
      if (i >= n) break;
      next[i++] = ch;
    }
    commit(next);
    focusAt(i);
  };
  const onChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const prev = chars[i];
    let t = e.target.value;
    // The box's own character may survive a keystroke that didn't replace it; the new text is what remains.
    if (prev && t.length > 1) t = t.startsWith(prev) ? t.slice(prev.length) : t.endsWith(prev) ? t.slice(0, -prev.length) : t;
    if (t === "") {
      const next = [...chars];
      next[i] = "";
      return commit(next);
    }
    fill(clean(t).length >= n ? 0 : i, t);
  };
  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      e.preventDefault();
      const next = [...chars];
      next[i - 1] = "";
      commit(next);
      focusAt(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    }
  };
  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const t = e.clipboardData.getData("text");
    fill(clean(t).length >= n ? 0 : i, t);
  };

  // Past six characters the boxes are grouped in threes or fours by a wider gap.
  const groupSize = n > 6 ? (n % 4 === 0 ? 4 : 3) : n;
  const groups: number[][] = [];
  for (let i = 0; i < n; i += groupSize) groups.push(Array.from({ length: Math.min(groupSize, n - i) }, (_, j) => i + j));

  return (
    <div className="pxd-field pxd-code" role="group" aria-labelledby={labelId} aria-describedby={describedBy(help && helpId)} {...a11y}>
      <div className="pxd-field-label" id={labelId}>
        {label}
        {required && <RequiredMark />}
      </div>
      {help && (
        <p className="pxd-field-help" id={helpId}>
          {help}
        </p>
      )}
      <div className="pxd-code-boxes">
        {groups.map((group, g) => (
          <div className="pxd-code-group" key={g}>
            {group.map((i) => (
              <input
                key={i}
                ref={(el) => {
                  boxes.current[i] = el;
                }}
                className="pxd-code-box"
                type="text"
                inputMode={numeric ? "numeric" : "text"}
                pattern={numeric ? "[0-9]*" : "[0-9A-Za-z]*"}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                autoCapitalize={numeric ? undefined : "characters"}
                spellCheck={false}
                aria-label={`Digit ${i + 1} of ${n}`}
                value={chars[i]}
                data-filled={chars[i] ? "" : undefined}
                required={required}
                onFocus={(e) => e.target.select()}
                onChange={(e) => onChange(i, e)}
                onKeyDown={(e) => onKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
