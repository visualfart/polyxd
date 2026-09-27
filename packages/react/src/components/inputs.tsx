import { createElement, useContext, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Checkbox, RadioGroup, Slider, Switch } from "radix-ui";
import { HeadingContext, resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { asList, absolute, childPointer, get, type Scope } from "../data.ts";
import { currencySymbol, formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Children } from "./structure.tsx";
import { Avatar, Icon } from "./avatar.tsx";

/**
 * The required mark. It is aria-hidden on purpose: every control it appears on also carries the
 * native `required` / `aria-required`, which is what a screen reader announces. The asterisk is
 * for the eye, and a form that has one explains it once (see RequiredLegend).
 */
const RequiredMark = () => (
  <span className="pxd-required" aria-hidden="true">
    *
  </span>
);

/** Label + help + control, with help associated to the control. */
function Field({ label, help, required, children, id, helpId }: { label: string; help?: string; required?: boolean; children: React.ReactNode; id: string; helpId: string }) {
  return (
    <div className="pxd-field">
      <label className="pxd-field-label" htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </label>
      {help && (
        <p className="pxd-field-help" id={helpId}>
          {help}
        </p>
      )}
      {children}
    </div>
  );
}

const INPUT_TYPE: Record<string, string> = { email: "email", phone: "tel", url: "url", search: "search", number: "text", currency: "text", text: "text" };

export function TextInput({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const id = useId();
  const helpId = useId();
  const kind = node.kind ?? "text";
  const raw = b.value<unknown>(node.value);
  const numeric = kind === "number" || kind === "currency";
  const [draft, setDraft] = useState<string | null>(null);
  // While typing, show exactly what was typed; otherwise show the stored value (currency to 2 places).
  const stored = raw === null || raw === undefined ? "" : kind === "currency" && typeof raw === "number" ? raw.toFixed(2) : String(raw);
  const shown = draft ?? stored;
  const v = node.validation ?? {};
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const common = {
    id,
    className: "pxd-input",
    "aria-describedby": help ? helpId : undefined,
    required: node.required,
    autoComplete: node.autocomplete,
    ...useA11y(node),
  };
  const onChange = (text: string) => {
    if (!numeric) return b.write(node.value, text);
    setDraft(text);
    const n = Number(text.replace(/[^\d.-]/g, ""));
    b.write(node.value, text.trim() === "" || Number.isNaN(n) ? null : n);
  };
  const invalid = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (v.message) (e.currentTarget as HTMLInputElement).setCustomValidity(b.text(v.message));
  };
  const clear = (e: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => (e.currentTarget as HTMLInputElement).setCustomValidity("");
  const label = b.text(node.label);
  const field = { label, help, required: node.required, id, helpId };

  if (kind === "suggestions" || kind === "mentions") return <CompletingInput node={node} field={field} common={common} mentions={kind === "mentions"} />;
  if (kind === "tags") return <TagsInput node={node} field={field} common={common} />;
  if (kind === "richtext") return <RichTextInput node={node} field={field} common={common} />;
  if (kind === "inline") return <InlineInput node={node} field={field} common={common} />;
  if (kind === "masked") {
    const mask = typeof node.mask === "string" ? node.mask : "";
    return (
      <Field {...field}>
        <input
          {...common}
          className="pxd-input pxd-input-masked"
          type="text"
          inputMode={/[A*]/.test(mask) ? undefined : "numeric"}
          placeholder={mask || undefined}
          value={stored}
          maxLength={mask.length || undefined}
          onChange={(e) => b.write(node.value, applyMask(mask, e.target.value, e.target.value.length < stored.length))}
          onInvalid={invalid}
          onInput={clear}
        />
      </Field>
    );
  }
  if (kind === "code") {
    return (
      <Field {...field}>
        <textarea {...common} className="pxd-input pxd-input-code" rows={4} spellCheck={false} autoCorrect="off" autoCapitalize="off" value={shown} maxLength={v.maxLength} minLength={v.minLength} onChange={(e) => onChange(e.target.value)} onInvalid={invalid} onInput={clear} />
      </Field>
    );
  }

  if (kind === "search") {
    // A search field: icon and placeholder inside a pill; the label remains its accessible name.
    const placeholder = node.placeholder !== undefined ? b.text(node.placeholder) : undefined;
    return (
      <div className="pxd-search">
        <label className="pxd-sr-only" htmlFor={id}>
          {b.text(node.label)}
        </label>
        <Icon name="search" />
        <input {...common} className="pxd-search-input" type="search" placeholder={placeholder} value={shown} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (node.size === "hero" && numeric) {
    // The one number this surface is about: large, centred, currency symbol dimmed.
    return (
      <div className="pxd-hero-field">
        <label className="pxd-hero-label" htmlFor={id}>
          {b.text(node.label)}
        </label>
        <div className="pxd-hero-input">
          {kind === "currency" && (
            <span className="pxd-hero-symbol" aria-hidden="true">
              {currencySymbol(b.text(node.currency) || "USD", s.locale)}
            </span>
          )}
          <input
            {...common}
            className="pxd-hero-value"
            type="text"
            inputMode={kind === "currency" ? "decimal" : "numeric"}
            pattern="-?[0-9]*[.,]?[0-9]*"
            placeholder="0"
            size={Math.max(1, shown.length || 1)}
            value={shown}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setDraft(null)}
            onInvalid={invalid}
            onInput={clear}
          />
        </div>
        {help && (
          <p className="pxd-field-help pxd-hero-help" id={helpId}>
            {help}
          </p>
        )}
      </div>
    );
  }

  const control =
    kind === "multiline" ? (
      <textarea {...common} rows={3} value={shown} maxLength={v.maxLength} minLength={v.minLength} onChange={(e) => onChange(e.target.value)} onInvalid={invalid} onInput={clear} />
    ) : (
      <div className={kind === "currency" ? "pxd-input-adorned" : undefined}>
        {kind === "currency" && (
          <span className="pxd-input-prefix" aria-hidden="true">
            {currencySymbol(b.text(node.currency) || "USD", s.locale)}
          </span>
        )}
        <input
          {...common}
          type={INPUT_TYPE[kind] ?? "text"}
          inputMode={kind === "currency" ? "decimal" : kind === "number" ? "numeric" : undefined}
          pattern={numeric ? "-?[0-9]*[.,]?[0-9]*" : undefined}
          value={shown}
          maxLength={v.maxLength}
          minLength={v.minLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setDraft(null)}
          onInvalid={invalid}
          onInput={clear}
        />
      </div>
    );
  return (
    <Field label={label} help={help} required={node.required} id={id} helpId={helpId}>
      {control}
    </Field>
  );
}

type FieldProps = { label: string; help?: string; required?: boolean; id: string; helpId: string };
type CommonProps = Record<string, unknown> & { id: string; className: string };

/** Fills a mask as you type: # takes a digit, A a letter, * either; other characters are typed for you. */
export function applyMask(mask: string, text: string, deleting = false): string {
  const chars = text.replace(/[^A-Za-z0-9]/g, "").split("");
  let out = "";
  let ci = 0;
  for (const m of mask) {
    if (ci >= chars.length) break;
    if (m === "#" || m === "A" || m === "*") {
      const ok = m === "#" ? /\d/ : m === "A" ? /[A-Za-z]/ : /./;
      while (ci < chars.length && !ok.test(chars[ci])) ci++;
      if (ci >= chars.length) break;
      out += chars[ci++];
    } else out += m;
  }
  // Deleting past a literal would put it straight back; drop trailing literals so Backspace moves on.
  if (deleting) while (out.length && !/[#A*]/.test(mask[out.length - 1])) out = out.slice(0, -1);
  return out;
}

/** A listbox under a text field, driven by the arrow keys; the option under the cursor is announced through aria-activedescendant. */
function useCombobox(options: Option[], pick: (o: Option) => void) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = open && options.length > 0;
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!shown) {
      if (e.key === "ArrowDown" && options.length) (setOpen(true), setActive(0), e.preventDefault());
      return;
    }
    if (e.key === "ArrowDown") (setActive((a) => (a + 1) % options.length), e.preventDefault());
    else if (e.key === "ArrowUp") (setActive((a) => (a - 1 + options.length) % options.length), e.preventDefault());
    else if (e.key === "Enter" && active >= 0) (pick(options[active]), setOpen(false), e.preventDefault());
    else if (e.key === "Escape") setOpen(false);
  };
  const inputProps = {
    role: "combobox",
    "aria-expanded": shown,
    "aria-controls": listId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": shown && active >= 0 ? `${listId}-${active}` : undefined,
    autoComplete: "off",
    onKeyDown,
    onBlur: () => setOpen(false),
  };
  const list = shown ? (
    <ul id={listId} role="listbox" className="pxd-combobox-list">
      {options.map((o, i) => (
        <li
          key={String(o.value)}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === active}
          className={`pxd-combobox-option${i === active ? " pxd-combobox-active" : ""}`}
          onMouseDown={(e) => (e.preventDefault(), pick(o), setOpen(false))}
        >
          {o.label}
          {o.description && <span className="pxd-option-description">{o.description}</span>}
        </li>
      ))}
    </ul>
  ) : null;
  return { list, inputProps, show: (on: boolean) => (setOpen(on), setActive(-1)) };
}

/** Free text with completions ('suggestions'), or an @ that offers people ('mentions'). */
function CompletingInput({ node, field, common, mentions }: { node: Node; field: FieldProps; common: CommonProps; mentions: boolean }) {
  const b = useBindings();
  const all = useOptions(node);
  const text = String(b.value(node.value) ?? "");
  // What is being completed: the whole value, or the word after the last @.
  const at = mentions ? /@([^\s@]*)$/.exec(text) : null;
  const query = mentions ? (at ? at[1] : null) : text;
  const options = query === null ? [] : all.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const combo = useCombobox(options, (o) => b.write(node.value, mentions && at ? `${text.slice(0, at.index)}@${o.label} ` : o.label));
  return (
    <Field {...field}>
      <div className="pxd-combobox">
        <input
          {...common}
          {...combo.inputProps}
          type="text"
          value={text}
          onChange={(e) => {
            b.write(node.value, e.target.value);
            combo.show(mentions ? /@[^\s@]*$/.test(e.target.value) : e.target.value.length > 0);
          }}
          onFocus={() => combo.show(!mentions && text.length > 0)}
        />
        {combo.list}
      </div>
    </Field>
  );
}

/** Several short values: Enter or a comma makes a chip of what was typed; Backspace in an empty field removes the last one. */
function TagsInput({ node, field, common }: { node: Node; field: FieldProps; common: CommonProps }) {
  const b = useBindings();
  const raw = b.value<unknown>(node.value);
  const tags = Array.isArray(raw) ? raw.map(String) : [];
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().replace(/,$/, "").trim();
    if (t && !tags.includes(t)) b.write(node.value, [...tags, t]);
    setDraft("");
  };
  const remove = (i: number) => b.write(node.value, tags.filter((_, j) => j !== i));
  return (
    <Field {...field}>
      <div className="pxd-tags" role="group" aria-label={field.label}>
        <ul className="pxd-tags-list">
          {tags.map((t, i) => (
            <li key={`${t}-${i}`} className="pxd-tag-chip">
              {t}
              <button type="button" className="pxd-tag-remove" aria-label={`Remove ${t}`} onClick={() => remove(i)}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <input
          {...common}
          className="pxd-tags-input"
          type="text"
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? (setDraft(e.target.value), add()) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.preventDefault(), add());
            else if (e.key === "Backspace" && draft === "" && tags.length) remove(tags.length - 1);
          }}
          onBlur={add}
        />
      </div>
    </Field>
  );
}

/** Inline emphasis and lists to and from the markdown-ish text a 'richtext' value holds. */
function toMarkup(n: globalThis.Node): string {
  if (n.nodeType === 3) return n.textContent ?? "";
  if (n.nodeType !== 1) return "";
  const el = n as HTMLElement;
  const inner = (x: globalThis.Node = el) => Array.from(x.childNodes).map(toMarkup).join("");
  switch (el.tagName.toLowerCase()) {
    case "b":
    case "strong":
      return `**${inner()}**`;
    case "i":
    case "em":
      return `*${inner()}*`;
    case "br":
      return "\n";
    case "ul":
      return Array.from(el.children).map((li) => `- ${inner(li)}`).join("\n") + "\n";
    case "ol":
      return Array.from(el.children).map((li, i) => `${i + 1}. ${inner(li)}`).join("\n") + "\n";
    case "div":
    case "p":
    case "li":
      return inner() + "\n";
    default:
      return inner();
  }
}
function inlineNodes(text: string): globalThis.Node[] {
  const out: globalThis.Node[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(document.createTextNode(text.slice(last, m.index)));
    const el = document.createElement(m[1] ? "strong" : "em");
    el.textContent = m[1] ?? m[2];
    out.push(el);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}
function fromMarkup(text: string): globalThis.Node[] {
  const out: globalThis.Node[] = [];
  let list: HTMLElement | null = null;
  for (const line of text.split("\n")) {
    const item = /^(-|\d+\.)\s+(.*)$/.exec(line);
    if (item) {
      const tag = item[1] === "-" ? "ul" : "ol";
      if (!list || list.tagName.toLowerCase() !== tag) (list = document.createElement(tag), out.push(list));
      const li = document.createElement("li");
      li.append(...inlineNodes(item[2]));
      list.append(li);
      continue;
    }
    list = null;
    const div = document.createElement("div");
    if (line) div.append(...inlineNodes(line));
    else div.append(document.createElement("br"));
    out.push(div);
  }
  return out;
}

/** A small editable area with Bold, Italic and List; the value is text with **bold**, *italic* and '- ' items. */
function RichTextInput({ node, field, common }: { node: Node; field: FieldProps; common: CommonProps }) {
  const b = useBindings();
  const ref = useRef<HTMLDivElement>(null);
  const stored = String(b.value(node.value) ?? "");
  useEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.ready) return;
    el.dataset.ready = "1";
    el.replaceChildren(...fromMarkup(stored));
  }, [stored]);
  const commit = () => ref.current && b.write(node.value, toMarkup(ref.current).replace(/\n+$/, ""));
  const exec = (command: string) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    ref.current?.focus();
    document.execCommand(command);
    commit();
  };
  const { id, className: _c, required: _r, autoComplete: _a, ...rest } = common;
  return (
    <Field {...field}>
      <div className="pxd-richtext">
        <div className="pxd-richtext-toolbar" role="toolbar" aria-label="Formatting">
          <button type="button" className="pxd-richtext-control" aria-label="Bold" onMouseDown={exec("bold")}>
            <strong>B</strong>
          </button>
          <button type="button" className="pxd-richtext-control" aria-label="Italic" onMouseDown={exec("italic")}>
            <em>I</em>
          </button>
          <button type="button" className="pxd-richtext-control" aria-label="Bulleted list" onMouseDown={exec("insertUnorderedList")}>
            <Icon name="menu" size={16} />
          </button>
        </div>
        <div {...rest} id={id} ref={ref} className="pxd-input pxd-richtext-area" contentEditable role="textbox" aria-multiline="true" aria-label={field.label} onInput={commit} onBlur={commit} />
      </div>
    </Field>
  );
}

/** Reads as text until Edit is chosen; Enter saves, Escape restores what was there. */
function InlineInput({ node, field, common }: { node: Node; field: FieldProps; common: CommonProps }) {
  const b = useBindings();
  const stored = String(b.value(node.value) ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  const save = () => {
    if (draft !== null) b.write(node.value, draft);
    setDraft(null);
  };
  if (draft === null) {
    return (
      <div className="pxd-inline-edit">
        <span className="pxd-field-label">{field.label}</span>
        <button type="button" className="pxd-inline-value" aria-label={`Edit ${field.label}`} onClick={() => setDraft(stored)}>
          <span className={stored ? undefined : "pxd-inline-empty"}>{stored || "Not set"}</span>
          <span className="pxd-inline-hint" aria-hidden="true">
            Edit
          </span>
        </button>
      </div>
    );
  }
  return (
    <Field {...field}>
      <input
        {...common}
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.preventDefault(), save());
          else if (e.key === "Escape") setDraft(null);
        }}
      />
    </Field>
  );
}

export interface Option {
  value: string | number | boolean;
  label: string;
  description?: string;
  avatar?: unknown;
  recent?: boolean;
}

/** A Choice's options, from literal options or host data. */
export function optionsOf(node: Node, data: unknown, scope: Scope, text: (v: unknown) => string): Option[] {
  const o = node.options;
  if (Array.isArray(o)) return o.map((x: any) => ({ value: x.value, label: text(x.label), description: x.description !== undefined ? text(x.description) : undefined }));
  const pointer = absolute(o.path, scope);
  const items = asList(get(data, pointer));
  return items.map((_, i) => {
    const p = { pointer: childPointer(pointer, i) };
    const at = (path?: string) => (path ? get(data, absolute(path, p)) : undefined);
    return {
      value: at(o.valuePath) as string,
      label: String(at(o.labelPath) ?? ""),
      description: o.descriptionPath ? String(at(o.descriptionPath) ?? "") || undefined : undefined,
      avatar: o.avatarPath || o.imagePath ? at(o.avatarPath ?? o.imagePath) ?? "" : undefined,
      recent: o.recentPath ? Boolean(at(o.recentPath)) : false,
    };
  });
}

function useOptions(node: Node): Option[] {
  const b = useBindings();
  const s = useSurface();
  return optionsOf(node, s.data, b.scope, b.text);
}

/** An option's visible label (its accessible name) and optional description (its accessible description). */
function OptionText({ id, label, description }: { id: string; label: string; description?: string }) {
  return (
    <div className="pxd-option-text">
      <label htmlFor={id}>{label}</label>
      {description && (
        <span className="pxd-option-description" id={`${id}-desc`}>
          {description}
        </span>
      )}
    </div>
  );
}

/**
 * Choice picks its control from the options' number and shape (see the Choice rendering rules):
 * people or things with faces → a picker (recent row, then a list); ≤ 6 short options → chips;
 * otherwise radios or checkboxes, searchable past 10.
 */
export function Choice({ node }: { node: Node }) {
  const b = useBindings();
  const labelId = useId();
  const helpId = useId();
  const options = useOptions(node);
  const [query, setQuery] = useState("");
  const multiple = node.mode === "multiple";
  const value = b.value<unknown>(node.value);
  const key = (v: unknown) => JSON.stringify(v);
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const withFaces = options.some((o) => o.avatar !== undefined);
  const searchable = options.length > 10 || (withFaces && options.length > 6);
  const matches = (o: Option) => !query || `${o.label} ${o.description ?? ""}`.toLowerCase().includes(query.toLowerCase());
  const chips = !withFaces && options.length <= 6 && options.every((o) => o.label.length <= 24 && !o.description);
  const a11y = useA11y(node);
  const label = b.text(node.label);
  const heading = (
    <div className="pxd-field-label" id={labelId}>
      {label}
      {node.required && <RequiredMark />}
    </div>
  );
  const search = searchable && (
    <div className="pxd-search pxd-search-compact">
      <Icon name="search" />
      <input type="search" className="pxd-search-input" placeholder={withFaces ? "Search by name" : "Filter options"} aria-label={`Search ${label}`} value={query} onChange={(e) => setQuery(e.target.value)} />
    </div>
  );

  if (multiple) {
    const selected = Array.isArray(value) ? value : [];
    const isOn = (v: unknown) => selected.some((x) => key(x) === key(v));
    const toggle = (v: unknown) => b.write(node.value, isOn(v) ? selected.filter((x) => key(x) !== key(v)) : [...selected, v]);
    if (chips) {
      return (
        <div className="pxd-field pxd-choice" role="group" aria-labelledby={labelId} aria-describedby={help ? helpId : undefined} {...a11y}>
          {heading}
          {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
          <div className="pxd-chips">
            {options.map((o) => (
              <Checkbox.Root key={key(o.value)} className="pxd-chip" checked={isOn(o.value)} onCheckedChange={() => toggle(o.value)}>
                <Checkbox.Indicator className="pxd-chip-check">
                  <Icon name="check" size={18} />
                </Checkbox.Indicator>
                {o.label}
              </Checkbox.Root>
            ))}
          </div>
        </div>
      );
    }
    if (withFaces) {
      // People are recognised by face and name, whether you pick one or several.
      const recent = query ? [] : options.filter((o) => o.recent);
      const rest = options.filter((o) => (query ? matches(o) : !o.recent));
      return (
        <fieldset className="pxd-field pxd-choice pxd-people" aria-describedby={help ? helpId : undefined} {...a11y}>
          <legend className="pxd-field-label" id={labelId}>
            {label}
          </legend>
          {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
          {search}
          <div className="pxd-people-group">
            {recent.length > 0 && (
              <div className="pxd-people-recent">
                {recent.map((o) => (
                  <Checkbox.Root key={key(o.value)} className="pxd-person-tile" checked={isOn(o.value)} onCheckedChange={() => toggle(o.value)} aria-label={o.label}>
                    <span className="pxd-person-face">
                      <Avatar value={o.avatar} name={o.label} size={56} />
                      <Checkbox.Indicator className="pxd-person-tick">
                        <Icon name="check" size={14} />
                      </Checkbox.Indicator>
                    </span>
                    <span className="pxd-person-name" aria-hidden="true">
                      {o.label.split(" ")[0]}
                    </span>
                  </Checkbox.Root>
                ))}
              </div>
            )}
            <div className="pxd-people-list">
              {rest.map((o) => {
                const cid = `${labelId}-${key(o.value)}`;
                return (
                  <Checkbox.Root
                    key={key(o.value)}
                    id={cid}
                    className="pxd-person-row"
                    checked={isOn(o.value)}
                    onCheckedChange={() => toggle(o.value)}
                    aria-labelledby={`${cid}-name`}
                    aria-describedby={o.description ? `${cid}-desc` : undefined}
                  >
                    <Avatar value={o.avatar} name={o.label} />
                    <span className="pxd-person-text">
                      <span id={`${cid}-name`}>{o.label}</span>
                      {o.description && (
                        <span className="pxd-option-description" id={`${cid}-desc`}>
                          {o.description}
                        </span>
                      )}
                    </span>
                    <Checkbox.Indicator className="pxd-person-check">
                      <Icon name="check" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                );
              })}
            </div>
          </div>
        </fieldset>
      );
    }
    return (
      <fieldset className="pxd-field pxd-choice" aria-describedby={help ? helpId : undefined} {...a11y}>
        <legend className="pxd-field-label" id={labelId}>
          {label}
        </legend>
        {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
        {search}
        <div className={`pxd-choice-list${searchable ? " pxd-choice-scroll" : ""}`}>
          {options.filter(matches).map((o) => {
            const cid = `${labelId}-${key(o.value)}`;
            return (
              <div className="pxd-choice-option" key={key(o.value)}>
                {o.avatar !== undefined && <Avatar value={o.avatar} name={o.label} size={32} />}
                <Checkbox.Root
                  id={cid}
                  className="pxd-checkbox"
                  checked={isOn(o.value)}
                  onCheckedChange={() => toggle(o.value)}
                  aria-describedby={o.description ? `${cid}-desc` : undefined}
                >
                  <Checkbox.Indicator className="pxd-checkbox-indicator">✓</Checkbox.Indicator>
                </Checkbox.Root>
                <OptionText id={cid} label={o.label} description={o.description} />
              </div>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const current = value === null || value === undefined ? "" : key(value);
  const onValueChange = (k: string) => b.write(node.value, options.find((o) => key(o.value) === k)?.value);

  if (chips) {
    return (
      <div className="pxd-field pxd-choice" {...a11y}>
        {heading}
        {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
        <RadioGroup.Root className="pxd-chips" aria-labelledby={labelId} aria-describedby={help ? helpId : undefined} aria-required={node.required || undefined} value={current} onValueChange={onValueChange} orientation="horizontal">
          {options.map((o) => (
            <RadioGroup.Item key={key(o.value)} value={key(o.value)} className="pxd-chip">
              <RadioGroup.Indicator className="pxd-chip-check">
                <Icon name="check" size={18} />
              </RadioGroup.Indicator>
              {o.label}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>
    );
  }

  if (withFaces) {
    // People or places: recent ones as a row of faces, everyone else as a list. Each appears once,
    // so no two controls share a name.
    const recent = query ? [] : options.filter((o) => o.recent);
    const rest = options.filter((o) => (query ? matches(o) : !o.recent));
    return (
      <div className="pxd-field pxd-choice pxd-people" {...a11y}>
        {heading}
        {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
        {search}
        <RadioGroup.Root aria-labelledby={labelId} aria-describedby={help ? helpId : undefined} aria-required={node.required || undefined} value={current} onValueChange={onValueChange} className="pxd-people-group">
          {recent.length > 0 && (
            <div className="pxd-people-recent" role="presentation">
              {recent.map((o) => (
                <RadioGroup.Item key={key(o.value)} value={key(o.value)} className="pxd-person-tile" aria-label={o.label}>
                  <Avatar value={o.avatar} name={o.label} size={56} />
                  <span className="pxd-person-name" aria-hidden="true">
                    {o.label.split(" ")[0]}
                  </span>
                </RadioGroup.Item>
              ))}
            </div>
          )}
          <div className="pxd-people-list" role="presentation">
            {rest.map((o) => {
              const cid = `${labelId}-${key(o.value)}`;
              return (
                <RadioGroup.Item key={key(o.value)} id={cid} value={key(o.value)} className="pxd-person-row" aria-labelledby={`${cid}-name`} aria-describedby={o.description ? `${cid}-desc` : undefined}>
                  <Avatar value={o.avatar} name={o.label} />
                  <span className="pxd-person-text">
                    <span id={`${cid}-name`}>{o.label}</span>
                    {o.description && (
                      <span className="pxd-option-description" id={`${cid}-desc`}>
                        {o.description}
                      </span>
                    )}
                  </span>
                  <RadioGroup.Indicator className="pxd-person-check">
                    <Icon name="check" />
                  </RadioGroup.Indicator>
                </RadioGroup.Item>
              );
            })}
          </div>
        </RadioGroup.Root>
      </div>
    );
  }

  return (
    <div className="pxd-field pxd-choice" {...a11y}>
      {heading}
      {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
      {search}
      <RadioGroup.Root
        className={`pxd-choice-list${searchable ? " pxd-choice-scroll" : ""}`}
        aria-labelledby={labelId}
        aria-describedby={help ? helpId : undefined}
        aria-required={node.required || undefined}
        value={current}
        onValueChange={onValueChange}
        orientation="vertical"
      >
        {options.filter(matches).map((o) => {
          const cid = `${labelId}-${key(o.value)}`;
          return (
            <div className="pxd-choice-option" key={key(o.value)}>
              <RadioGroup.Item id={cid} value={key(o.value)} className="pxd-radio" aria-describedby={o.description ? `${cid}-desc` : undefined}>
                <RadioGroup.Indicator className="pxd-radio-indicator" />
              </RadioGroup.Item>
              <OptionText id={cid} label={o.label} description={o.description} />
            </div>
          );
        })}
      </RadioGroup.Root>
    </div>
  );
}

/** With an action it's a switch that applies immediately; inside a form it's a checkbox. */
export function Toggle({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const id = useId();
  const descId = useId();
  const checked = Boolean(b.value(node.value));
  const description = node.description !== undefined ? b.text(node.description) : undefined;
  const change = (next: boolean) => {
    b.write(node.value, next);
    if (node.action) {
      // Dispatch with the new value applied, so context bound to it carries the change.
      const ptr = b.pointer(node.value);
      const context = Object.fromEntries(
        Object.entries(node.action.event.context ?? {}).map(([k, v]: [string, any]) => [k, v && typeof v === "object" && "path" in v && absolute(v.path, b.scope) === ptr ? next : b.value(v)]),
      );
      s.dispatch({ event: { name: node.action.event.name, context } }, { pointer: "" }, node.id);
    }
  };
  const a11y = useA11y(node);
  return (
    <div className="pxd-toggle">
      {node.action ? (
        <Switch.Root id={id} className="pxd-switch" checked={checked} onCheckedChange={change} aria-describedby={description ? descId : undefined} {...a11y}>
          <Switch.Thumb className="pxd-switch-thumb" />
        </Switch.Root>
      ) : (
        <Checkbox.Root id={id} className="pxd-checkbox" checked={checked} onCheckedChange={(c) => change(c === true)} aria-describedby={description ? descId : undefined} {...a11y}>
          <Checkbox.Indicator className="pxd-checkbox-indicator">✓</Checkbox.Indicator>
        </Checkbox.Root>
      )}
      <div className="pxd-toggle-text">
        <label htmlFor={id} className="pxd-toggle-label">
          {b.text(node.label)}
        </label>
        {description && (
          <p className="pxd-field-help" id={descId}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

const DATE_TYPE: Record<string, string> = { date: "date", time: "time", datetime: "datetime-local", month: "month" };

/** Native date/time inputs: typing is always possible, and pickers are platform-native. */
export function DateInput({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const id = useId();
  const helpId = useId();
  const kind = node.kind ?? "date";
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const value = b.value<unknown>(node.value);
  const min = node.min !== undefined ? b.text(node.min) : undefined;
  const max = node.max !== undefined ? b.text(node.max) : undefined;
  const a11y = useA11y(node);
  if (node.multiple && kind !== "dateRange") {
    // Each chosen date is a chip; the field adds another.
    const dates = Array.isArray(value) ? value.map(String) : [];
    const spoken = (d: string) => formatValue(d, { type: kind === "month" ? "date" : kind === "time" ? "time" : kind === "datetime" ? "datetime" : "date" }, s.locale);
    const add = (d: string) => d && !dates.includes(d) && b.write(node.value, [...dates, d].sort());
    return (
      <fieldset className="pxd-field pxd-date-multiple" {...a11y}>
        <legend className="pxd-field-label">
          {b.text(node.label)}
          {node.required && <RequiredMark />}
        </legend>
        {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
        {dates.length > 0 && (
          <ul className="pxd-tags-list" aria-label={`Chosen ${b.text(node.label)}`}>
            {dates.map((d) => (
              <li key={d} className="pxd-tag-chip">
                {kind === "year" || kind === "month" ? d : spoken(d)}
                <button type="button" className="pxd-tag-remove" aria-label={`Remove ${d}`} onClick={() => b.write(node.value, dates.filter((x) => x !== d))}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="pxd-date-add" htmlFor={id}>
          <span className="pxd-sr-only">Add a date</span>
          {kind === "year" ? (
            <input id={id} className="pxd-input pxd-input-year" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="YYYY" aria-describedby={help ? helpId : undefined} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add(e.currentTarget.value), (e.currentTarget.value = ""))} onBlur={(e) => (add(e.currentTarget.value), (e.currentTarget.value = ""))} />
          ) : (
            <input id={id} className="pxd-input pxd-input-date" type={DATE_TYPE[kind]} min={min} max={max} aria-describedby={help ? helpId : undefined} onChange={(e) => (add(e.target.value), (e.target.value = ""))} />
          )}
        </label>
      </fieldset>
    );
  }
  if (kind === "year") {
    return (
      <Field label={b.text(node.label)} help={help} required={node.required} id={id} helpId={helpId}>
        <input
          id={id}
          className="pxd-input pxd-input-year"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          placeholder="YYYY"
          value={(value as string) ?? ""}
          min={min}
          max={max}
          required={node.required}
          aria-describedby={help ? helpId : undefined}
          onChange={(e) => b.write(node.value, e.target.value.replace(/\D/g, "").slice(0, 4) || null)}
          {...a11y}
        />
      </Field>
    );
  }
  if (kind === "dateRange") {
    const [start, end] = Array.isArray(value) ? value : [];
    const setAt = (i: number, v: string) => {
      const next = [start ?? null, end ?? null];
      next[i] = v || null;
      b.write(node.value, next);
    };
    return (
      <fieldset className="pxd-field" {...a11y}>
        <legend className="pxd-field-label">{b.text(node.label)}</legend>
        {help && <p className="pxd-field-help">{help}</p>}
        <div className="pxd-date-range">
          <label>
            From
            <input className="pxd-input" type="date" value={start ?? ""} min={min} max={max} required={node.required} onChange={(e) => setAt(0, e.target.value)} />
          </label>
          <label>
            To
            <input className="pxd-input" type="date" value={end ?? ""} min={start ?? min} max={max} required={node.required} onChange={(e) => setAt(1, e.target.value)} />
          </label>
        </div>
      </fieldset>
    );
  }
  return (
    <Field label={b.text(node.label)} help={help} required={node.required} id={id} helpId={helpId}>
      <input
        id={id}
        className={`pxd-input pxd-input-date${kind === "month" ? " pxd-input-month" : ""}`}
        type={DATE_TYPE[kind]}
        value={(value as string) ?? ""}
        min={min}
        max={max}
        required={node.required}
        aria-describedby={help ? helpId : undefined}
        onChange={(e) => b.write(node.value, e.target.value || null)}
        {...a11y}
      />
    </Field>
  );
}

export function RangeInput({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const labelId = useId();
  const minId = useId();
  const maxId = useId();
  const fmt = (n: number) => formatValue(n, resolveFormat(node.format ?? { type: "number" }, s.data, b.scope), s.locale);
  const a11y = useA11y(node);
  if (node.mode === "range") {
    const raw = b.value<unknown>(node.value);
    const [lo, hi] = Array.isArray(raw) ? raw.map(Number) : [node.min, node.max];
    const set = (a: number, c: number) => b.write(node.value, [Math.max(node.min, Math.min(a, c)), Math.min(node.max, Math.max(a, c))]);
    return (
      <div className="pxd-field pxd-range" role="group" aria-labelledby={labelId} {...a11y}>
        <div className="pxd-range-header">
          <span className="pxd-field-label" id={labelId}>
            {b.text(node.label)}
          </span>
          <output className="pxd-range-value" aria-live="polite">
            {fmt(lo)} – {fmt(hi)}
          </output>
        </div>
        <Slider.Root className="pxd-slider" min={node.min} max={node.max} step={node.step ?? 1} value={[lo, hi]} minStepsBetweenThumbs={1} onValueChange={([a, c]) => set(a, c)}>
          <Slider.Track className="pxd-slider-track">
            <Slider.Range className="pxd-slider-range" />
          </Slider.Track>
          <Slider.Thumb className="pxd-slider-thumb" aria-label="Minimum" aria-valuetext={fmt(lo)} />
          <Slider.Thumb className="pxd-slider-thumb" aria-label="Maximum" aria-valuetext={fmt(hi)} />
        </Slider.Root>
        <div className="pxd-range-fields">
          <label htmlFor={minId}>
            <span>Minimum</span>
            <input id={minId} className="pxd-input" inputMode="numeric" value={lo} onChange={(e) => set(Number(e.target.value) || node.min, hi)} />
          </label>
          <span aria-hidden="true">–</span>
          <label htmlFor={maxId}>
            <span>Maximum</span>
            <input id={maxId} className="pxd-input" inputMode="numeric" value={hi} onChange={(e) => set(lo, Number(e.target.value) || node.max)} />
          </label>
        </div>
      </div>
    );
  }
  const value = Number(b.value(node.value) ?? node.min);
  return (
    <div className="pxd-field pxd-range" {...a11y}>
      <div className="pxd-range-header">
        <span className="pxd-field-label" id={labelId}>
          {b.text(node.label)}
        </span>
        <output className="pxd-range-value" aria-live="polite">
          {fmt(value)}
        </output>
      </div>
      <Slider.Root className="pxd-slider" min={node.min} max={node.max} step={node.step ?? 1} value={[value]} onValueChange={([v]) => b.write(node.value, v)}>
        <Slider.Track className="pxd-slider-track">
          <Slider.Range className="pxd-slider-range" />
        </Slider.Track>
        <Slider.Thumb className="pxd-slider-thumb" aria-labelledby={labelId} aria-valuetext={fmt(value)} />
      </Slider.Root>
      <div className="pxd-range-bounds" aria-hidden="true">
        <span>{fmt(node.min)}</span>
        <span>{fmt(node.max)}</span>
      </div>
    </div>
  );
}

/** A field the summary points at: the control's id, what it is called, and what is wrong with it. */
type Problem = { id: string; label: string; message: string };
type Control = HTMLInputElement & { pxdNote?: HTMLElement; pxdDescribed?: string | null };

/** What a control is called, as the summary says it: its label, else its aria-label, else its field's. */
function controlName(control: Control): string {
  const own = control.labels?.[0]?.textContent ?? control.getAttribute("aria-label") ?? control.closest(".pxd-field")?.querySelector(".pxd-field-label, legend")?.textContent ?? "";
  return own.replace(/\*\s*$/, "").trim(); // the required mark is for the eye, not the summary
}

/** The controls that failed, in DOM order, one per radio group. Each gets an id the summary can link to. */
function collectProblems(form: HTMLFormElement, base: string): Control[] {
  const seen = new Set<string>();
  const out: Control[] = [];
  for (const el of Array.from(form.elements) as Control[]) {
    if (!el.willValidate || el.validity.valid) continue;
    if (el.type === "radio" && el.name) {
      if (seen.has(el.name)) continue;
      seen.add(el.name);
    }
    if (!el.id) el.id = `${base}-${out.length}`;
    out.push(el);
  }
  return out;
}

/**
 * Submits through checkValidity, so every control's own message is set (onInvalid) without the
 * browser's bubbles. When something fails, a summary at the top of the fields says what, in plain
 * words, and links to each control; each control is marked and, if its field says nothing yet, the
 * message is said under it. The marks are undone on the next submit and redone from scratch.
 */
export function Form({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const level = Math.min(useContext(HeadingContext), 6);
  const summaryId = useId();
  const summary = useRef<HTMLElement>(null);
  const marked = useRef<Control[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  // An asterisk has to say what it means, once, before the fields it marks.
  const anyRequired = (node.children ?? []).some((id: string) => s.byId.get(id)?.required);

  useEffect(() => {
    if (problems.length) summary.current?.focus();
  }, [problems]);

  const unmark = () => {
    for (const c of marked.current) {
      c.removeAttribute("aria-invalid");
      if (c.pxdDescribed) c.setAttribute("aria-describedby", c.pxdDescribed);
      else c.removeAttribute("aria-describedby");
      c.pxdNote?.remove();
      c.pxdNote = undefined;
    }
    marked.current = [];
  };
  const mark = (controls: Control[]) => {
    for (const c of controls) {
      c.setAttribute("aria-invalid", "true");
      const field = c.closest(".pxd-field");
      if (field && !field.querySelector(".pxd-field-error")) {
        const note = field.ownerDocument.createElement("p");
        note.className = "pxd-field-error";
        note.id = `${c.id}-error`;
        note.textContent = c.validationMessage;
        field.append(note);
        c.pxdNote = note;
        c.pxdDescribed = c.getAttribute("aria-describedby");
        c.setAttribute("aria-describedby", [c.pxdDescribed, note.id].filter(Boolean).join(" "));
      }
    }
    marked.current = controls;
  };
  const goTo = (id: string) => {
    const el = summary.current?.ownerDocument.getElementById(id) as Control | null;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus();
    // A Radix group's native input is hidden; the group's first real control takes the focus.
    if (el.ownerDocument.activeElement !== el) el.closest(".pxd-field")?.querySelector<HTMLElement>("[role='radio'], button, input:not([aria-hidden]), textarea, select")?.focus();
  };

  return (
    <form
      className={`pxd-form${node.aside ? " pxd-form-with-aside" : ""}${node.layout === "horizontal" ? " pxd-form-horizontal" : ""}`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        unmark();
        if (!form.checkValidity()) {
          const failed = collectProblems(form, summaryId);
          mark(failed);
          return setProblems(failed.map((c) => ({ id: c.id, label: controlName(c), message: c.validationMessage })));
        }
        setProblems([]);
        s.dispatch(node.submit.action, b.scope, node.id);
      }}
      {...useA11y(node)}
    >
      {node.aside && (
        <aside className="pxd-form-aside">
          <Render id={node.aside} />
        </aside>
      )}
      <div className="pxd-stack pxd-form-fields">
        {problems.length > 0 && (
          <section ref={summary} className="pxd-error-summary" role="alert" tabIndex={-1} aria-labelledby={summaryId}>
            {createElement(`h${level}`, { id: summaryId, className: "pxd-error-summary-title" }, "Check these fields before continuing")}
            <ul className="pxd-error-summary-list">
              {problems.map((p) => (
                <li key={p.id}>
                  <a
                    href={`#${p.id}`}
                    className="pxd-link"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(p.id);
                    }}
                  >
                    {p.label ? `${p.label}: ${p.message}` : p.message}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {anyRequired && (
          <p className="pxd-required-legend">
            <span className="pxd-required" aria-hidden="true">
              *
            </span>{" "}
            Required
          </p>
        )}
        <Children ids={node.children} />
      </div>
      <div className="pxd-action-bar">
        <button type="submit" className="pxd-button pxd-button-primary">
          {b.text(node.submit.label)}
        </button>
        {node.cancel && (
          <button type="button" className="pxd-button pxd-button-secondary" onClick={() => s.dispatch(node.cancel.action, b.scope, node.id)}>
            {b.text(node.cancel.label)}
          </button>
        )}
      </div>
    </form>
  );
}

export { Render };
