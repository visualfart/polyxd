import { useId, useRef, useState, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { RadioGroup } from "radix-ui";
import { useBindings, useSurface, type Node, type SurfaceContextValue } from "../context.tsx";
import { absolute } from "../data.ts";
import { useA11y } from "../surface.tsx";
import { optionsOf } from "./inputs.tsx";
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
  const ptr = b.pointer(node.value);
  const context = Object.fromEntries(
    Object.entries(node.action.event.context ?? {}).map(([k, v]: [string, any]) => [k, v && typeof v === "object" && "path" in v && absolute(v.path, b.scope) === ptr ? next : b.value(v)]),
  );
  s.dispatch({ event: { name: node.action.event.name, context } }, { pointer: "" }, node.id);
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

const UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

function formatBytes(n: number, locale: string): string {
  let i = 0;
  let v = n;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  try {
    return new Intl.NumberFormat(locale, { style: "unit", unit: UNITS[i], unitDisplay: "short", maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
  } catch {
    return `${Math.round(v * 10) / 10} ${["B", "KB", "MB", "GB"][i]}`;
  }
}

/** '.pdf' → 'PDF', 'image/*' → 'images', 'application/zip' → 'ZIP'. */
function describeType(a: string): string {
  const t = a.trim().toLowerCase();
  if (t.startsWith(".")) return t.slice(1).toUpperCase();
  const wild: Record<string, string> = { "image/*": "images", "video/*": "videos", "audio/*": "audio", "text/*": "text files" };
  if (wild[t]) return wild[t];
  if (t === "application/pdf") return "PDF";
  const sub = t.split("/")[1];
  return sub ? sub.replace(/^(x-|vnd\.)/, "").toUpperCase() : a;
}

function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

function matchesAccept(file: File, accept: string[]): boolean {
  if (accept.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.some((a) => {
    const t = a.trim().toLowerCase();
    if (t.startsWith(".")) return name.endsWith(t);
    if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
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
  const acceptText = accept.length ? listText(accept.map(describeType)) : "";
  const limits = [acceptText && `Accepts ${acceptText}.`, maxSize && `Up to ${formatBytes(maxSize, s.locale)}${multiple ? " each" : ""}.`].filter(Boolean).join(" ");
  const help = [node.help !== undefined ? b.text(node.help) : "", limits].filter(Boolean).join(" ") || undefined;

  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const chosen = Array.from(list);
    const accepted: FileRef[] = [];
    const refused: string[] = [];
    for (const f of multiple ? chosen : chosen.slice(0, 1)) {
      if (maxSize && f.size > maxSize) refused.push(`${f.name} is ${formatBytes(f.size, s.locale)}; the limit is ${formatBytes(maxSize, s.locale)}.`);
      else if (!matchesAccept(f, accept)) refused.push(`${f.name} isn't an accepted type${acceptText ? ` (${acceptText})` : ""}.`);
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

type ColorFormat = "hex" | "rgb" | "hsl";
interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
const parseAlpha = (t: string | undefined) => (t === undefined ? 1 : clamp(t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t), 0, 1));
const channel = (t: string) => (t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t));

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  h /= 6;
  return [h * 360, s, l];
}

/** Parse CSS hex, rgb()/rgba() and hsl()/hsla() text; null when it isn't a colour yet. */
function parseColor(text: unknown): RGBA | null {
  if (typeof text !== "string") return null;
  const t = text.trim();
  const hex = /^#([0-9a-f]{3,8})$/i.exec(t);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split("").map((c) => parseInt(c + c, 16));
      return { r, g, b, a: h.length === 4 ? a / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const at = (i: number) => parseInt(h.slice(i, i + 2), 16);
      return { r: at(0), g: at(2), b: at(4), a: h.length === 8 ? at(6) / 255 : 1 };
    }
    return null;
  }
  const fn = /^(rgba?|hsla?)\(\s*([^)]+?)\s*\)$/i.exec(t);
  if (!fn) return null;
  const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const a = parseAlpha(parts[3]);
  if (Number.isNaN(a)) return null;
  if (fn[1].toLowerCase().startsWith("rgb")) {
    const [r, g, b] = parts.slice(0, 3).map(channel);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a };
  }
  const h = parseFloat(parts[0]);
  const sat = parseFloat(parts[1]) / 100;
  const light = parseFloat(parts[2]) / 100;
  if ([h, sat, light].some(Number.isNaN)) return null;
  const [r, g, b] = hslToRgb(h, clamp(sat, 0, 1), clamp(light, 0, 1));
  return { r, g, b, a };
}

/** Write a colour as CSS text in the requested format; alpha appears only when allowed and below 1. */
function formatColor(c: RGBA, format: ColorFormat, alpha: boolean): string {
  const a = alpha ? Math.round(c.a * 100) / 100 : 1;
  const r = Math.round(c.r);
  const g = Math.round(c.g);
  const b = Math.round(c.b);
  if (format === "rgb") return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
  if (format === "hsl") {
    const [h, s, l] = rgbToHsl(r, g, b);
    const hh = Math.round(h);
    const ss = Math.round(s * 100);
    const ll = Math.round(l * 100);
    return a < 1 ? `hsla(${hh}, ${ss}%, ${ll}%, ${a})` : `hsl(${hh}, ${ss}%, ${ll}%)`;
  }
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a * 255) : ""}`;
}

const toHex6 = (c: RGBA | null) => (c ? `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}` : "#000000");

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
  const same = (a: RGBA | null, c: RGBA | null) => Boolean(a && c && Math.round(a.r) === Math.round(c.r) && Math.round(a.g) === Math.round(c.g) && Math.round(a.b) === Math.round(c.b) && (!alpha || Math.abs(a.a - c.a) < 0.005));
  const matchIdx = swatches.findIndex((o) => (parsed ? same(parseColor(o.value), parsed) : String(o.value) === storedText && storedText !== ""));
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
        placeholder={format === "hex" ? "#000000" : format === "rgb" ? "rgb(0, 0, 0)" : "hsl(0, 0%, 0%)"}
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
