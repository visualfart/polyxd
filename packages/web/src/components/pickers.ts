import { clamp, colorPlaceholder, contextWithValue, fileLimits, formatBytes, formatColor, optionsOf, parseColor, refuseFile, sameColor, toHex6, type ColorFormat, type Node, type RGBA } from "@polyxd/core";
import { h, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { RadioGroup, RadioItem } from "../primitives.ts";
import { Icon } from "./avatar.ts";
import { RequiredMark } from "./inputs.ts";

/*
 * Pickers: files, colours and one-time codes. Each follows the input conventions in inputs.ts:
 * a `pxd-field` with a `pxd-field-label`, optional `pxd-field-help`, the required mark, and the
 * value written back through the node's binding.
 */

const describedBy = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;
const typed = (e: Event) => (e.target as HTMLInputElement).value;

/* ---- FileInput ---- */

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

export function FileInput(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const id = ctx.id(node);
  const helpId = ctx.id(node, "help");
  const errorId = ctx.id(node, "error");
  const [error, setError] = ctx.state<string | null>(node, "error", null);
  const [dragging, setDragging] = ctx.state<boolean>(node, "dragging", false);
  const raw = b.value<unknown>(node.value);
  const files: FileRef[] = Array.isArray(raw) ? raw : [];
  const accept: string[] = Array.isArray(node.accept) ? node.accept : [];
  const maxSize: number | undefined = node.maxSize;
  const multiple = Boolean(node.multiple);
  const label = b.text(node.label);
  // The limits are always said before choosing, after whatever the host says about what to attach.
  const help = [node.help !== undefined ? b.text(node.help) : "", fileLimits(accept, maxSize, multiple, r.locale)].filter(Boolean).join(" ") || undefined;

  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const chosen = Array.from(list);
    const accepted: FileRef[] = [];
    const refused: string[] = [];
    for (const f of multiple ? chosen : chosen.slice(0, 1)) {
      const why = refuseFile(f, accept, maxSize, r.locale);
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
  return h(
    "div",
    { class: "pxd-field pxd-file" },
    h("label", { class: "pxd-field-label", for: id }, label, node.required && RequiredMark()),
    help && h("p", { class: "pxd-field-help", id: helpId }, help),
    h(
      "div",
      {
        class: "pxd-dropzone",
        "data-dragging": dragging || undefined,
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer?.files ?? null);
        },
        onDragover: (e: DragEvent) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        },
        onDragleave: (e: DragEvent) => {
          // Leaving a child still counts as inside the zone.
          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as globalThis.Node | null)) setDragging(false);
        },
      },
      // The input is the real control: it covers the zone, so a click anywhere opens the chooser and the keyboard reaches it as usual.
      h("input", {
        id,
        class: "pxd-dropzone-input",
        type: "file",
        accept: accept.length ? accept.join(",") : undefined,
        multiple,
        required: node.required && files.length === 0,
        "aria-describedby": describedBy(help && helpId, error && errorId),
        "aria-invalid": error ? true : undefined,
        onChange: (e: Event) => {
          const input = e.target as HTMLInputElement;
          add(input.files);
          input.value = "";
        },
        ...ctx.a11y(node),
      }),
      h("span", { class: "pxd-dropzone-icon", "aria-hidden": "true" }, Icon("file", 24)),
      h("span", { class: "pxd-dropzone-text" }, h("span", { class: "pxd-dropzone-action" }, multiple ? "Choose files" : "Choose a file"), h("span", { class: "pxd-dropzone-hint" }, multiple ? "or drop them here" : "or drop it here")),
    ),
    error && h("p", { class: "pxd-field-error", id: errorId, role: "alert" }, error),
    files.length > 0 &&
      h(
        "ul",
        { class: "pxd-file-list" },
        ...files.map((f, i) =>
          h(
            "li",
            { class: "pxd-file-item", key: `${f.name}-${f.size}-${i}` },
            h("span", { class: "pxd-file-icon", "aria-hidden": "true" }, Icon("file", 18)),
            h("span", { class: "pxd-file-text" }, h("span", { class: "pxd-file-name" }, f.name), h("span", { class: "pxd-file-size" }, formatBytes(f.size, r.locale)), typeof f.progress === "number" && f.progress < 1 && h("progress", { class: "pxd-file-progress", value: f.progress, max: 1, "aria-label": `Uploading ${f.name}` })),
            h("button", { type: "button", class: "pxd-file-remove", "aria-label": `Remove ${f.name}`, onClick: () => remove(i) }, Icon("close", 18)),
          ),
        ),
      ),
  );
}

/* ---- ColorInput ---- */

const OTHER = "__other";

export function ColorInput(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const labelId = ctx.id(node, "label");
  const helpId = ctx.id(node, "help");
  const pickerId = ctx.id(node, "picker");
  const textId = ctx.id(node, "text");
  const alphaId = ctx.id(node, "alpha");
  const format: ColorFormat = node.format ?? "hex";
  const alpha = Boolean(node.alpha);
  const label = b.text(node.label);
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const stored = b.value<unknown>(node.value);
  const storedText = stored === null || stored === undefined ? "" : String(stored);
  const parsed = parseColor(storedText);
  const [draft, setDraft] = ctx.state<string | null>(node, "draft", null);
  const [otherChosen, setOtherChosen] = ctx.state<boolean>(node, "other", false);
  const a11y = ctx.a11y(node);
  const swatches = node.swatches ? optionsOf({ ...node, options: node.swatches }, ctx.r.data, b.scope, b.text) : [];
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
  const opacity = Math.round((parsed?.a ?? 1) * 100);

  const picker = () =>
    h(
      "div",
      { class: "pxd-color-picker" },
      h("input", {
        id: pickerId,
        class: "pxd-color-native",
        type: "color",
        value: toHex6(parsed),
        "aria-label": `${label}: pick`,
        "aria-describedby": describedBy(help && helpId),
        onInput: (e: Event) => {
          const c = parseColor(typed(e));
          if (c) {
            setDraft(null);
            write({ ...c, a: parsed?.a ?? 1 });
          }
        },
      }),
      h("input", { id: textId, class: "pxd-input pxd-input-mono pxd-color-text", type: "text", inputmode: "text", autocomplete: "off", spellcheck: "false", placeholder: colorPlaceholder(format), value: draft ?? storedText, "aria-label": `${label}: value`, "aria-describedby": describedBy(help && helpId), "aria-invalid": draft !== null && draft !== "" && !parseColor(draft) ? true : undefined, required: !hasSwatches && node.required, onInput: (e: Event) => onText(typed(e)), onBlur: () => setDraft(null) }),
      alpha &&
        h(
          "label",
          { class: "pxd-color-alpha", for: alphaId },
          h("span", { class: "pxd-color-alpha-label" }, "Opacity"),
          h("input", {
            id: alphaId,
            type: "range",
            min: 0,
            max: 100,
            step: 1,
            value: String(opacity),
            disabled: !parsed,
            "aria-valuetext": `${opacity}%`,
            onInput: (e: Event) => {
              if (parsed) {
                setDraft(null);
                write({ ...parsed, a: Number(typed(e)) / 100 });
              }
            },
          }),
          h("output", { class: "pxd-color-alpha-value", for: alphaId, "aria-hidden": "true" }, `${opacity}%`),
        ),
    );

  if (!hasSwatches) {
    return h("div", { class: "pxd-field pxd-color", role: "group", "aria-labelledby": labelId, "aria-describedby": describedBy(help && helpId), ...a11y }, h("div", { class: "pxd-field-label", id: labelId }, label, node.required && RequiredMark()), help && h("p", { class: "pxd-field-help", id: helpId }, help), picker());
  }
  const choose = (k: string) => {
    if (k === OTHER) return setOtherChosen(true);
    setOtherChosen(false);
    setDraft(null);
    const o = swatches[Number(k)];
    const c = parseColor(o.value);
    b.write(node.value, c ? formatColor(c, format, alpha) : o.value);
  };
  return h(
    "div",
    { class: "pxd-field pxd-color", ...a11y },
    h("div", { class: "pxd-field-label", id: labelId }, label, node.required && RequiredMark()),
    help && h("p", { class: "pxd-field-help", id: helpId }, help),
    RadioGroup(
      { class: "pxd-swatches", "aria-labelledby": labelId, "aria-describedby": describedBy(help && helpId), "aria-required": node.required || undefined, value: current, orientation: "horizontal", onValueChange: choose },
      ...swatches.map((o, i) => RadioItem({ key: String(i), value: String(i), group: current, first: i === 0, onSelect: () => choose(String(i)), class: "pxd-swatch", title: o.label, "data-orientation": "horizontal" }, h("span", { class: "pxd-swatch-color", style: { background: String(o.value) }, "aria-hidden": "true" }), h("span", { class: "pxd-swatch-name" }, o.label))),
      RadioItem({ key: OTHER, value: OTHER, group: current, onSelect: () => choose(OTHER), class: "pxd-swatch pxd-swatch-other", title: "Other", "data-orientation": "horizontal" }, h("span", { class: "pxd-swatch-color", style: current === OTHER && parsed ? { background: storedText } : undefined, "aria-hidden": "true" }), h("span", { class: "pxd-swatch-name" }, "Other")),
    ),
    showPicker && picker(),
  );
}

/* ---- CodeInput ---- */

const fromString = (text: string, n: number): string[] => Array.from({ length: n }, (_, i) => text[i] ?? "");

export function CodeInput(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const labelId = ctx.id(node, "label");
  const helpId = ctx.id(node, "help");
  const n = clamp(Number(node.length) || 6, 4, 12);
  const numeric = (node.kind ?? "numeric") === "numeric";
  const required = node.required ?? true;
  const label = b.text(node.label);
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const raw = b.value<unknown>(node.value);
  const stored = raw === null || raw === undefined ? "" : String(raw);
  const [state] = ctx.state<{ chars: string[]; seen: string; fired: string | null }>(node, "code", () => ({ chars: fromString(stored, n), seen: stored, fired: null }));
  // The host may reset or fill the code (e.g. after a failed attempt); follow it.
  if (stored !== state.seen) {
    state.seen = stored;
    if (stored !== state.chars.join("")) state.chars = fromString(stored, n);
  }
  const chars = state.chars;
  const a11y = ctx.a11y(node);
  const boxes = () => Array.from(ctx.r.root?.querySelectorAll<HTMLInputElement>(`[data-pxd-id="${CSS.escape(node.id)}"] .pxd-code-box`) ?? []);
  const clean = (t: string) => t.replace(numeric ? /[^0-9]/g : /[^0-9a-zA-Z]/g, "");
  const focusAt = (i: number) => boxes()[clamp(i, 0, n - 1)]?.focus();
  const commit = (next: string[]) => {
    state.chars = next;
    const code = next.join("");
    state.seen = code;
    b.write(node.value, code);
    if (node.action && next.every(Boolean) && code !== state.fired) {
      // Every box is in: run the action once for this code, so no button is needed.
      state.fired = code;
      ctx.r.dispatch({ event: { name: node.action.event.name, context: contextWithValue(node, ctx.r.data, b.scope, code) } }, { pointer: "" }, node.id);
    }
    ctx.r.schedule();
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
  const onInput = (i: number, e: Event) => {
    const prev = chars[i];
    let t = (e.target as HTMLInputElement).value;
    // The box's own character may survive a keystroke that didn't replace it; the new text is what remains.
    if (prev && t.length > 1) t = t.startsWith(prev) ? t.slice(prev.length) : t.endsWith(prev) ? t.slice(0, -prev.length) : t;
    if (t === "") {
      const next = [...chars];
      next[i] = "";
      return commit(next);
    }
    fill(clean(t).length >= n ? 0 : i, t);
  };
  const onKeyDown = (i: number, e: KeyboardEvent) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      e.preventDefault();
      const next = [...chars];
      next[i - 1] = "";
      commit(next);
      focusAt(i - 1);
    } else if (e.key === "ArrowLeft") (e.preventDefault(), focusAt(i - 1));
    else if (e.key === "ArrowRight") (e.preventDefault(), focusAt(i + 1));
  };
  const onPaste = (i: number, e: ClipboardEvent) => {
    e.preventDefault();
    const t = e.clipboardData?.getData("text") ?? "";
    fill(clean(t).length >= n ? 0 : i, t);
  };
  // Past six characters the boxes are grouped in threes or fours by a wider gap.
  const groupSize = n > 6 ? (n % 4 === 0 ? 4 : 3) : n;
  const groups: number[][] = [];
  for (let i = 0; i < n; i += groupSize) groups.push(Array.from({ length: Math.min(groupSize, n - i) }, (_, j) => i + j));
  return h(
    "div",
    { class: "pxd-field pxd-code", role: "group", "aria-labelledby": labelId, "aria-describedby": describedBy(help && helpId), ...a11y },
    h("div", { class: "pxd-field-label", id: labelId }, label, required && RequiredMark()),
    help && h("p", { class: "pxd-field-help", id: helpId }, help),
    h(
      "div",
      { class: "pxd-code-boxes" },
      ...groups.map((group, g) =>
        h(
          "div",
          { class: "pxd-code-group", key: g },
          ...group.map((i) =>
            h("input", { key: i, class: "pxd-code-box", type: "text", inputmode: numeric ? "numeric" : "text", pattern: numeric ? "[0-9]*" : "[0-9A-Za-z]*", autocomplete: i === 0 ? "one-time-code" : "off", autocapitalize: numeric ? undefined : "characters", spellcheck: "false", "aria-label": `Digit ${i + 1} of ${n}`, value: chars[i], "data-filled": chars[i] ? "" : undefined, required, onFocus: (e: Event) => (e.target as HTMLInputElement).select(), onInput: (e: Event) => onInput(i, e), onKeydown: (e: KeyboardEvent) => onKeyDown(i, e), onPaste: (e: ClipboardEvent) => onPaste(i, e) }),
          ),
        ),
      ),
    ),
  );
}
