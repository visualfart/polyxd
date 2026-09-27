import {
  addTag, applyMask, contextWithValue, currencySymbol, formatValue, idOf, isSelected, maskIsNumeric, matchesQuery, numericValue, optionKey, optionsOf, partitionRecent, planChoice, resolveFormat, searchPlaceholder, storedText, toggleSelection,
  type Node, type Option,
} from "@polyxd/core";
import { h, type Props, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Checkbox, RadioGroup, RadioItem, Slider, Switch } from "../primitives.ts";
import { Avatar, Icon } from "./avatar.ts";
import { Children } from "./structure.ts";

/**
 * The required mark. It is aria-hidden on purpose: every control it appears on also carries the
 * native `required` / `aria-required`, which is what a screen reader announces. The asterisk is
 * for the eye, and a form that has one explains it once (see the legend in Form).
 */
export const RequiredMark = (): VNode => h("span", { class: "pxd-required", "aria-hidden": "true" }, "*");

type FieldProps = { label: string; help?: string; required?: boolean; id: string; helpId: string };

/** Label + help + control, with help associated to the control. */
function Field({ label, help, required, id, helpId }: FieldProps, ...children: VChild[]): VNode {
  return h("div", { class: "pxd-field" }, h("label", { class: "pxd-field-label", for: id }, label, required && RequiredMark()), help && h("p", { class: "pxd-field-help", id: helpId }, help), ...children);
}

const INPUT_TYPE: Record<string, string> = { email: "email", phone: "tel", url: "url", search: "search", number: "text", currency: "text", text: "text" };

/** Reads the value typed and the caret it was typed at, so the same draft shows until the field is left. */
const typed = (e: Event) => (e.target as HTMLInputElement).value;

export function TextInput(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const id = ctx.id(node);
  const helpId = ctx.id(node, "help");
  const kind = node.kind ?? "text";
  const raw = b.value<unknown>(node.value);
  const numeric = kind === "number" || kind === "currency";
  const [draft, setDraft] = ctx.state<string | null>(node, "draft", null);
  // While typing, show exactly what was typed; otherwise show the stored value (currency to 2 places).
  const stored = storedText(raw, kind);
  const shown = draft ?? stored;
  const v = node.validation ?? {};
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const common: Props = { id, class: "pxd-input", "aria-describedby": help ? helpId : undefined, required: node.required, autocomplete: node.autocomplete, ...ctx.a11y(node) };
  const onChange = (text: string) => {
    if (!numeric) return b.write(node.value, text);
    setDraft(text);
    b.write(node.value, numericValue(text));
  };
  const invalid = (e: Event) => {
    if (v.message) (e.currentTarget as HTMLInputElement).setCustomValidity(b.text(v.message));
  };
  const clear = (e: Event) => (e.currentTarget as HTMLInputElement).setCustomValidity("");
  const label = b.text(node.label);
  const field = { label, help, required: node.required, id, helpId };

  if (kind === "suggestions" || kind === "mentions") return CompletingInput(node, ctx, field, common, kind === "mentions");
  if (kind === "tags") return TagsInput(node, ctx, field, common);
  if (kind === "richtext") return RichTextInput(node, ctx, field, common);
  if (kind === "inline") return InlineInput(node, ctx, field, common);
  if (kind === "masked") {
    const mask = typeof node.mask === "string" ? node.mask : "";
    return Field(field, h("input", { ...common, class: "pxd-input pxd-input-masked", type: "text", inputmode: maskIsNumeric(mask) ? "numeric" : undefined, placeholder: mask || undefined, value: stored, maxlength: mask.length || undefined, onInput: (e: Event) => (clear(e), b.write(node.value, applyMask(mask, typed(e), typed(e).length < stored.length))), onInvalid: invalid }));
  }
  if (kind === "code") {
    return Field(field, h("textarea", { ...common, class: "pxd-input pxd-input-code", rows: 4, spellcheck: "false", autocorrect: "off", autocapitalize: "off", value: shown, maxlength: v.maxLength, minlength: v.minLength, onInput: (e: Event) => (clear(e), onChange(typed(e))), onInvalid: invalid }));
  }
  if (kind === "search") {
    // A search field: icon and placeholder inside a pill; the label remains its accessible name.
    const placeholder = node.placeholder !== undefined ? b.text(node.placeholder) : undefined;
    return h("div", { class: "pxd-search" }, h("label", { class: "pxd-sr-only", for: id }, b.text(node.label)), Icon("search"), h("input", { ...common, class: "pxd-search-input", type: "search", placeholder, value: shown, onInput: (e: Event) => onChange(typed(e)) }));
  }
  if (node.size === "hero" && numeric) {
    // The one number this surface is about: large, centred, currency symbol dimmed.
    return h(
      "div",
      { class: "pxd-hero-field" },
      h("label", { class: "pxd-hero-label", for: id }, b.text(node.label)),
      h(
        "div",
        { class: "pxd-hero-input" },
        kind === "currency" && h("span", { class: "pxd-hero-symbol", "aria-hidden": "true" }, currencySymbol(b.text(node.currency) || "USD", r.locale)),
        h("input", { ...common, class: "pxd-hero-value", type: "text", inputmode: kind === "currency" ? "decimal" : "numeric", pattern: "-?[0-9]*[.,]?[0-9]*", placeholder: "0", size: Math.max(1, shown.length || 1), value: shown, onInput: (e: Event) => (clear(e), onChange(typed(e))), onBlur: () => setDraft(null), onInvalid: invalid }),
      ),
      help && h("p", { class: "pxd-field-help pxd-hero-help", id: helpId }, help),
    );
  }
  const control =
    kind === "multiline"
      ? h("textarea", { ...common, rows: 3, value: shown, maxlength: v.maxLength, minlength: v.minLength, onInput: (e: Event) => (clear(e), onChange(typed(e))), onInvalid: invalid })
      : h(
          "div",
          { class: kind === "currency" ? "pxd-input-adorned" : undefined },
          kind === "currency" && h("span", { class: "pxd-input-prefix", "aria-hidden": "true" }, currencySymbol(b.text(node.currency) || "USD", r.locale)),
          h("input", { ...common, type: INPUT_TYPE[kind] ?? "text", inputmode: kind === "currency" ? "decimal" : kind === "number" ? "numeric" : undefined, pattern: numeric ? "-?[0-9]*[.,]?[0-9]*" : undefined, value: shown, maxlength: v.maxLength, minlength: v.minLength, onInput: (e: Event) => (clear(e), onChange(typed(e))), onBlur: () => setDraft(null), onInvalid: invalid }),
        );
  return Field(field, control);
}

/** A listbox under a text field, driven by the arrow keys; the option under the cursor is announced through aria-activedescendant. */
function combobox(node: Node, ctx: Ctx, options: Option[], pick: (o: Option) => void) {
  const listId = ctx.id(node, "list");
  const [open, setOpen] = ctx.state<boolean>(node, "open", false);
  const [active, setActive] = ctx.state<number>(node, "active", -1);
  const shown = open && options.length > 0;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!shown) {
      if (e.key === "ArrowDown" && options.length) (setOpen(true), setActive(0), e.preventDefault());
      return;
    }
    if (e.key === "ArrowDown") (setActive((a) => (a + 1) % options.length), e.preventDefault());
    else if (e.key === "ArrowUp") (setActive((a) => (a - 1 + options.length) % options.length), e.preventDefault());
    else if (e.key === "Enter" && active >= 0) (pick(options[active]), setOpen(false), e.preventDefault());
    else if (e.key === "Escape") setOpen(false);
  };
  const inputProps: Props = { role: "combobox", "aria-expanded": shown, "aria-controls": listId, "aria-autocomplete": "list", "aria-activedescendant": shown && active >= 0 ? `${listId}-${active}` : undefined, autocomplete: "off", onKeydown: onKeyDown, onBlur: () => setOpen(false) };
  const list = shown
    ? h(
        "ul",
        { id: listId, role: "listbox", class: "pxd-combobox-list" },
        ...options.map((o, i) =>
          h("li", { key: String(o.value), id: `${listId}-${i}`, role: "option", "aria-selected": i === active, class: `pxd-combobox-option${i === active ? " pxd-combobox-active" : ""}`, onMousedown: (e: Event) => (e.preventDefault(), pick(o), setOpen(false)) }, o.label, o.description && h("span", { class: "pxd-option-description" }, o.description)),
        ),
      )
    : null;
  return { list, inputProps, show: (on: boolean) => (setOpen(on), setActive(-1)) };
}

/** Free text with completions ('suggestions'), or an @ that offers people ('mentions'). */
function CompletingInput(node: Node, ctx: Ctx, field: FieldProps, common: Props, mentions: boolean): VNode {
  const b = ctx.b;
  const all = optionsOf(node, ctx.r.data, b.scope, b.text);
  const text = String(b.value(node.value) ?? "");
  // What is being completed: the whole value, or the word after the last @.
  const at = mentions ? /@([^\s@]*)$/.exec(text) : null;
  const query = mentions ? (at ? at[1] : null) : text;
  const options = query === null ? [] : all.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const combo = combobox(node, ctx, options, (o) => b.write(node.value, mentions && at ? `${text.slice(0, at.index)}@${o.label} ` : o.label));
  return Field(
    field,
    h(
      "div",
      { class: "pxd-combobox" },
      h("input", {
        ...common,
        ...combo.inputProps,
        type: "text",
        value: text,
        onInput: (e: Event) => {
          const v = typed(e);
          b.write(node.value, v);
          combo.show(mentions ? /@[^\s@]*$/.test(v) : v.length > 0);
        },
        onFocus: () => combo.show(!mentions && text.length > 0),
      }),
      combo.list,
    ),
  );
}

/** Several short values: Enter or a comma makes a chip of what was typed; Backspace in an empty field removes the last one. */
function TagsInput(node: Node, ctx: Ctx, field: FieldProps, common: Props): VNode {
  const b = ctx.b;
  const raw = b.value<unknown>(node.value);
  const tags = Array.isArray(raw) ? raw.map(String) : [];
  const [draft, setDraft] = ctx.state<string>(node, "tags", "");
  const add = (text = draft) => {
    const next = addTag(tags, text);
    if (next !== tags) b.write(node.value, next);
    setDraft("");
  };
  const remove = (i: number) => b.write(node.value, tags.filter((_, j) => j !== i));
  return Field(
    field,
    h(
      "div",
      { class: "pxd-tags", role: "group", "aria-label": field.label },
      h("ul", { class: "pxd-tags-list" }, ...tags.map((t, i) => h("li", { key: `${t}-${i}`, class: "pxd-tag-chip" }, t, h("button", { type: "button", class: "pxd-tag-remove", "aria-label": `Remove ${t}`, onClick: () => remove(i) }, Icon("close", 14))))),
      h("input", {
        ...common,
        class: "pxd-tags-input",
        type: "text",
        value: draft,
        onInput: (e: Event) => (typed(e).endsWith(",") ? add(typed(e)) : setDraft(typed(e))),
        onKeydown: (e: KeyboardEvent) => {
          if (e.key === "Enter") (e.preventDefault(), add());
          else if (e.key === "Backspace" && draft === "" && tags.length) remove(tags.length - 1);
        },
        onBlur: () => add(),
      }),
    ),
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
function RichTextInput(node: Node, ctx: Ctx, field: FieldProps, common: Props): VNode {
  const b = ctx.b;
  const stored = String(b.value(node.value) ?? "");
  const commit = (el: HTMLElement) => b.write(node.value, toMarkup(el).replace(/\n+$/, ""));
  const exec = (command: string) => (e: Event) => {
    e.preventDefault();
    const area = (e.currentTarget as HTMLElement).closest(".pxd-richtext")?.querySelector<HTMLElement>(".pxd-richtext-area");
    if (!area) return;
    area.focus();
    document.execCommand(command);
    commit(area);
  };
  const { id, class: _c, required: _r, autocomplete: _a, ...rest } = common;
  return Field(
    field,
    h(
      "div",
      { class: "pxd-richtext" },
      h(
        "div",
        { class: "pxd-richtext-toolbar", role: "toolbar", "aria-label": "Formatting" },
        h("button", { type: "button", class: "pxd-richtext-control", "aria-label": "Bold", onMousedown: exec("bold") }, h("strong", null, "B")),
        h("button", { type: "button", class: "pxd-richtext-control", "aria-label": "Italic", onMousedown: exec("italic") }, h("em", null, "I")),
        h("button", { type: "button", class: "pxd-richtext-control", "aria-label": "Bulleted list", onMousedown: exec("insertUnorderedList") }, Icon("menu", 16)),
      ),
      h("div", {
        ...rest,
        id,
        class: "pxd-input pxd-richtext-area",
        contenteditable: "true",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": field.label,
        ref: (el: Element | null) => {
          const area = el as HTMLElement | null;
          if (!area || area.dataset.ready) return;
          area.dataset.ready = "1";
          area.replaceChildren(...fromMarkup(stored));
        },
        onInput: (e: Event) => commit(e.currentTarget as HTMLElement),
        onBlur: (e: Event) => commit(e.currentTarget as HTMLElement),
      }),
    ),
  );
}

/** Reads as text until Edit is chosen; Enter saves, Escape restores what was there. */
function InlineInput(node: Node, ctx: Ctx, field: FieldProps, common: Props): VNode {
  const b = ctx.b;
  const stored = String(b.value(node.value) ?? "");
  const [draft, setDraft] = ctx.state<string | null>(node, "inline", null);
  const save = () => {
    if (draft !== null) b.write(node.value, draft);
    setDraft(null);
  };
  if (draft === null) {
    return h(
      "div",
      { class: "pxd-inline-edit" },
      h("span", { class: "pxd-field-label" }, field.label),
      h("button", { type: "button", class: "pxd-inline-value", "aria-label": `Edit ${field.label}`, onClick: () => setDraft(stored) }, h("span", { class: stored ? undefined : "pxd-inline-empty" }, stored || "Not set"), h("span", { class: "pxd-inline-hint", "aria-hidden": "true" }, "Edit")),
    );
  }
  return Field(
    field,
    h("input", {
      ...common,
      type: "text",
      value: draft,
      ref: (el: Element | null) => el && !(el as HTMLElement).dataset.focused && ((el as HTMLElement).dataset.focused = "1", (el as HTMLInputElement).focus()),
      onInput: (e: Event) => setDraft(typed(e)),
      onBlur: save,
      onKeydown: (e: KeyboardEvent) => {
        if (e.key === "Enter") (e.preventDefault(), save());
        else if (e.key === "Escape") setDraft(null);
      },
    }),
  );
}

/** An option's visible label (its accessible name) and optional description (its accessible description). */
const OptionText = (id: string, label: string, description?: string): VNode => h("div", { class: "pxd-option-text" }, h("label", { for: id }, label), description && h("span", { class: "pxd-option-description", id: `${id}-desc` }, description));

const checkIndicator = (cls: string, ...children: VChild[]) => h("span", { "data-state": "checked", class: cls, style: { pointerEvents: "none" } }, ...children);

/**
 * Choice picks its control from the options' number and shape (core's rule): people or things
 * with faces → a picker (recent row, then a list); a few short options → chips; otherwise radios
 * or checkboxes, searchable past 10.
 */
export function Choice(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const labelId = ctx.id(node, "label");
  const helpId = ctx.id(node, "help");
  const options = optionsOf(node, ctx.r.data, b.scope, b.text);
  const [query, setQuery] = ctx.state<string>(node, "query", "");
  const plan = planChoice(options, node.mode);
  const { multiple, withFaces, searchable } = plan;
  const chips = plan.control === "chips";
  const value = b.value<unknown>(node.value);
  const key = optionKey;
  const cid = (v: unknown) => idOf(labelId, v);
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const a11y = ctx.a11y(node);
  const label = b.text(node.label);
  const heading = h("div", { class: "pxd-field-label", id: labelId }, label, node.required && RequiredMark());
  const helpEl = help && h("p", { class: "pxd-field-help", id: helpId }, help);
  const search = searchable && h("div", { class: "pxd-search pxd-search-compact" }, Icon("search"), h("input", { type: "search", class: "pxd-search-input", placeholder: searchPlaceholder(withFaces), "aria-label": `Search ${label}`, value: query, onInput: (e: Event) => setQuery(typed(e)) }));
  const matches = (o: Option) => matchesQuery(o, query);

  if (multiple) {
    const isOn = (v: unknown) => isSelected(value, v);
    const toggle = (v: unknown) => b.write(node.value, toggleSelection(value, v));
    if (chips) {
      return h(
        "div",
        { class: "pxd-field pxd-choice", role: "group", "aria-labelledby": labelId, "aria-describedby": help ? helpId : undefined, ...a11y },
        heading,
        helpEl,
        h("div", { class: "pxd-chips" }, ...options.map((o) => Checkbox({ key: key(o.value), class: "pxd-chip", checked: isOn(o.value), onCheckedChange: () => toggle(o.value), indicator: checkIndicator("pxd-chip-check", Icon("check", 18)) }, o.label))),
      );
    }
    if (withFaces) {
      // People are recognised by face and name, whether you pick one or several.
      const { recent, rest } = partitionRecent(options, query);
      return h(
        "fieldset",
        { class: "pxd-field pxd-choice pxd-people", "aria-describedby": help ? helpId : undefined, ...a11y },
        h("legend", { class: "pxd-field-label", id: labelId }, label),
        helpEl,
        search,
        h(
          "div",
          { class: "pxd-people-group" },
          recent.length > 0 &&
            h(
              "div",
              { class: "pxd-people-recent" },
              ...recent.map((o) =>
                Checkbox(
                  { key: key(o.value), class: "pxd-person-tile", checked: isOn(o.value), onCheckedChange: () => toggle(o.value), "aria-label": o.label, indicator: null },
                  h("span", { class: "pxd-person-face" }, Avatar(ctx, { value: o.avatar, name: o.label, size: 56 }), isOn(o.value) && checkIndicator("pxd-person-tick", Icon("check", 14))),
                  h("span", { class: "pxd-person-name", "aria-hidden": "true" }, o.label.split(" ")[0]),
                ),
              ),
            ),
          h(
            "div",
            { class: "pxd-people-list" },
            ...rest.map((o) => {
              const id = cid(o.value);
              return Checkbox(
                { key: key(o.value), id, class: "pxd-person-row", checked: isOn(o.value), onCheckedChange: () => toggle(o.value), "aria-labelledby": `${id}-name`, "aria-describedby": o.description ? `${id}-desc` : undefined, indicator: null },
                Avatar(ctx, { value: o.avatar, name: o.label }),
                h("span", { class: "pxd-person-text" }, h("span", { id: `${id}-name` }, o.label), o.description && h("span", { class: "pxd-option-description", id: `${id}-desc` }, o.description)),
                isOn(o.value) && checkIndicator("pxd-person-check", Icon("check")),
              );
            }),
          ),
        ),
      );
    }
    return h(
      "fieldset",
      { class: "pxd-field pxd-choice", "aria-describedby": help ? helpId : undefined, ...a11y },
      h("legend", { class: "pxd-field-label", id: labelId }, label),
      helpEl,
      search,
      h(
        "div",
        { class: `pxd-choice-list${searchable ? " pxd-choice-scroll" : ""}` },
        ...options.filter(matches).map((o) => {
          const id = cid(o.value);
          return h(
            "div",
            { class: "pxd-choice-option", key: key(o.value) },
            o.avatar !== undefined && Avatar(ctx, { value: o.avatar, name: o.label, size: 32 }),
            Checkbox({ id, class: "pxd-checkbox", checked: isOn(o.value), onCheckedChange: () => toggle(o.value), "aria-describedby": o.description ? `${id}-desc` : undefined, indicator: checkIndicator("pxd-checkbox-indicator", "✓") }),
            OptionText(id, o.label, o.description),
          );
        }),
      ),
    );
  }

  const current = value === null || value === undefined ? "" : key(value);
  const onValueChange = (k: string) => b.write(node.value, options.find((o) => key(o.value) === k)?.value);
  const radio = (o: Option, i: number, props: Props, indicator: VChild, ...children: VChild[]) => RadioItem({ key: key(o.value), value: key(o.value), group: current, first: i === 0, onSelect: () => onValueChange(key(o.value)), indicator, ...props }, ...children);

  if (chips) {
    return h(
      "div",
      { class: "pxd-field pxd-choice", ...a11y },
      heading,
      helpEl,
      RadioGroup({ class: "pxd-chips", "aria-labelledby": labelId, "aria-describedby": help ? helpId : undefined, "aria-required": node.required || undefined, value: current, onValueChange, orientation: "horizontal" }, ...options.map((o, i) => radio(o, i, { class: "pxd-chip", "data-orientation": "horizontal" }, checkIndicator("pxd-chip-check", Icon("check", 18)), o.label))),
    );
  }

  if (withFaces) {
    // People or places: recent ones as a row of faces, everyone else as a list. Each appears once.
    const { recent, rest } = partitionRecent(options, query);
    return h(
      "div",
      { class: "pxd-field pxd-choice pxd-people", ...a11y },
      heading,
      helpEl,
      search,
      RadioGroup(
        { "aria-labelledby": labelId, "aria-describedby": help ? helpId : undefined, "aria-required": node.required || undefined, value: current, onValueChange, class: "pxd-people-group" },
        recent.length > 0 && h("div", { class: "pxd-people-recent", role: "presentation" }, ...recent.map((o, i) => radio(o, i, { class: "pxd-person-tile", "aria-label": o.label }, null, Avatar(ctx, { value: o.avatar, name: o.label, size: 56 }), h("span", { class: "pxd-person-name", "aria-hidden": "true" }, o.label.split(" ")[0])))),
        h(
          "div",
          { class: "pxd-people-list", role: "presentation" },
          ...rest.map((o, i) => {
            const id = cid(o.value);
            return radio(
              o,
              recent.length + i,
              { id, class: "pxd-person-row", "aria-labelledby": `${id}-name`, "aria-describedby": o.description ? `${id}-desc` : undefined },
              null,
              Avatar(ctx, { value: o.avatar, name: o.label }),
              h("span", { class: "pxd-person-text" }, h("span", { id: `${id}-name` }, o.label), o.description && h("span", { class: "pxd-option-description", id: `${id}-desc` }, o.description)),
              current === key(o.value) && checkIndicator("pxd-person-check", Icon("check")),
            );
          }),
        ),
      ),
    );
  }

  return h(
    "div",
    { class: "pxd-field pxd-choice", ...a11y },
    heading,
    helpEl,
    search,
    RadioGroup(
      { class: `pxd-choice-list${searchable ? " pxd-choice-scroll" : ""}`, "aria-labelledby": labelId, "aria-describedby": help ? helpId : undefined, "aria-required": node.required || undefined, value: current, onValueChange, orientation: "vertical" },
      ...options.filter(matches).map((o, i) => {
        const id = cid(o.value);
        return h("div", { class: "pxd-choice-option", key: key(o.value) }, radio(o, i, { id, class: "pxd-radio", "aria-describedby": o.description ? `${id}-desc` : undefined, "data-orientation": "vertical" }, h("span", { "data-state": "checked", class: "pxd-radio-indicator", style: { pointerEvents: "none" } })), OptionText(id, o.label, o.description));
      }),
    ),
  );
}

/** With an action it's a switch that applies immediately; inside a form it's a checkbox. */
export function Toggle(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const id = ctx.id(node);
  const descId = ctx.id(node, "desc");
  const checked = Boolean(b.value(node.value));
  const description = node.description !== undefined ? b.text(node.description) : undefined;
  const change = (next: boolean) => {
    b.write(node.value, next);
    // Dispatch with the new value applied, so context bound to it carries the change.
    if (node.action) ctx.r.dispatch({ event: { name: node.action.event.name, context: contextWithValue(node, ctx.r.data, b.scope, next) } }, { pointer: "" }, node.id);
  };
  const a11y = ctx.a11y(node);
  return h(
    "div",
    { class: "pxd-toggle" },
    node.action
      ? Switch({ id, class: "pxd-switch", checked, onCheckedChange: change, "aria-describedby": description ? descId : undefined, ...a11y })
      : Checkbox({ id, class: "pxd-checkbox", checked, onCheckedChange: (c) => change(c === true), "aria-describedby": description ? descId : undefined, ...a11y, indicator: checkIndicator("pxd-checkbox-indicator", "✓") }),
    h("div", { class: "pxd-toggle-text" }, h("label", { for: id, class: "pxd-toggle-label" }, b.text(node.label)), description && h("p", { class: "pxd-field-help", id: descId }, description)),
  );
}

const DATE_TYPE: Record<string, string> = { date: "date", time: "time", datetime: "datetime-local", month: "month" };

/** Native date/time inputs: typing is always possible, and pickers are platform-native. */
export function DateInput(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const id = ctx.id(node);
  const helpId = ctx.id(node, "help");
  const kind = node.kind ?? "date";
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const value = b.value<unknown>(node.value);
  const min = node.min !== undefined ? b.text(node.min) : undefined;
  const max = node.max !== undefined ? b.text(node.max) : undefined;
  const a11y = ctx.a11y(node);
  const label = b.text(node.label);
  if (node.multiple && kind !== "dateRange") {
    // Each chosen date is a chip; the field adds another.
    const dates = Array.isArray(value) ? value.map(String) : [];
    const spoken = (d: string) => formatValue(d, { type: kind === "month" ? "date" : kind === "time" ? "time" : kind === "datetime" ? "datetime" : "date" }, r.locale);
    const add = (d: string) => d && !dates.includes(d) && b.write(node.value, [...dates, d].sort());
    const take = (e: Event) => {
      const el = e.currentTarget as HTMLInputElement;
      add(el.value);
      el.value = "";
    };
    return h(
      "fieldset",
      { class: "pxd-field pxd-date-multiple", ...a11y },
      h("legend", { class: "pxd-field-label" }, label, node.required && RequiredMark()),
      help && h("p", { class: "pxd-field-help", id: helpId }, help),
      dates.length > 0 && h("ul", { class: "pxd-tags-list", "aria-label": `Chosen ${label}` }, ...dates.map((d) => h("li", { key: d, class: "pxd-tag-chip" }, kind === "year" || kind === "month" ? d : spoken(d), h("button", { type: "button", class: "pxd-tag-remove", "aria-label": `Remove ${d}`, onClick: () => b.write(node.value, dates.filter((x) => x !== d)) }, Icon("close", 14))))),
      h(
        "label",
        { class: "pxd-date-add", for: id },
        h("span", { class: "pxd-sr-only" }, "Add a date"),
        kind === "year"
          ? h("input", { id, class: "pxd-input pxd-input-year", inputmode: "numeric", pattern: "[0-9]{4}", maxlength: 4, placeholder: "YYYY", "aria-describedby": help ? helpId : undefined, onKeydown: (e: KeyboardEvent) => e.key === "Enter" && (e.preventDefault(), take(e)), onBlur: take })
          : h("input", { id, class: "pxd-input pxd-input-date", type: DATE_TYPE[kind], min, max, "aria-describedby": help ? helpId : undefined, onChange: take }),
      ),
    );
  }
  if (kind === "year") {
    return Field({ label, help, required: node.required, id, helpId }, h("input", { id, class: "pxd-input pxd-input-year", inputmode: "numeric", pattern: "[0-9]{4}", maxlength: 4, placeholder: "YYYY", value: (value as string) ?? "", min, max, required: node.required, "aria-describedby": help ? helpId : undefined, onInput: (e: Event) => b.write(node.value, typed(e).replace(/\D/g, "").slice(0, 4) || null), ...a11y }));
  }
  if (kind === "dateRange") {
    const [start, end] = Array.isArray(value) ? value : [];
    const setAt = (i: number, v: string) => {
      const next = [start ?? null, end ?? null];
      next[i] = v || null;
      b.write(node.value, next);
    };
    return h(
      "fieldset",
      { class: "pxd-field", ...a11y },
      h("legend", { class: "pxd-field-label" }, label),
      help && h("p", { class: "pxd-field-help" }, help),
      h(
        "div",
        { class: "pxd-date-range" },
        h("label", null, "From", h("input", { class: "pxd-input", type: "date", value: start ?? "", min, max, required: node.required, onChange: (e: Event) => setAt(0, typed(e)) })),
        h("label", null, "To", h("input", { class: "pxd-input", type: "date", value: end ?? "", min: start ?? min, max, required: node.required, onChange: (e: Event) => setAt(1, typed(e)) })),
      ),
    );
  }
  return Field({ label, help, required: node.required, id, helpId }, h("input", { id, class: `pxd-input pxd-input-date${kind === "month" ? " pxd-input-month" : ""}`, type: DATE_TYPE[kind], value: (value as string) ?? "", min, max, required: node.required, "aria-describedby": help ? helpId : undefined, onChange: (e: Event) => b.write(node.value, typed(e) || null), ...a11y }));
}

export function RangeInput(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const labelId = ctx.id(node, "label");
  const minId = ctx.id(node, "min");
  const maxId = ctx.id(node, "max");
  const fmt = (n: number) => formatValue(n, resolveFormat(node.format ?? { type: "number" }, r.data, b.scope), r.locale);
  const a11y = ctx.a11y(node);
  if (node.mode === "range") {
    const raw = b.value<unknown>(node.value);
    const [lo, hi] = Array.isArray(raw) ? raw.map(Number) : [node.min, node.max];
    const set = (a: number, c: number) => b.write(node.value, [Math.max(node.min, Math.min(a, c)), Math.min(node.max, Math.max(a, c))]);
    return h(
      "div",
      { class: "pxd-field pxd-range", role: "group", "aria-labelledby": labelId, ...a11y },
      h("div", { class: "pxd-range-header" }, h("span", { class: "pxd-field-label", id: labelId }, b.text(node.label)), h("output", { class: "pxd-range-value", "aria-live": "polite" }, `${fmt(lo)} – ${fmt(hi)}`)),
      Slider({ min: node.min, max: node.max, step: node.step ?? 1, values: [lo, hi], minStepsBetweenThumbs: 1, onValueChange: ([a, c]) => set(a, c), thumbs: [{ "aria-label": "Minimum", "aria-valuetext": fmt(lo) }, { "aria-label": "Maximum", "aria-valuetext": fmt(hi) }] }),
      h(
        "div",
        { class: "pxd-range-fields" },
        h("label", { for: minId }, h("span", null, "Minimum"), h("input", { id: minId, class: "pxd-input", inputmode: "numeric", value: String(lo), onInput: (e: Event) => set(Number(typed(e)) || node.min, hi) })),
        h("span", { "aria-hidden": "true" }, "–"),
        h("label", { for: maxId }, h("span", null, "Maximum"), h("input", { id: maxId, class: "pxd-input", inputmode: "numeric", value: String(hi), onInput: (e: Event) => set(lo, Number(typed(e)) || node.max) })),
      ),
    );
  }
  const value = Number(b.value(node.value) ?? node.min);
  return h(
    "div",
    { class: "pxd-field pxd-range", ...a11y },
    h("div", { class: "pxd-range-header" }, h("span", { class: "pxd-field-label", id: labelId }, b.text(node.label)), h("output", { class: "pxd-range-value", "aria-live": "polite" }, fmt(value))),
    Slider({ min: node.min, max: node.max, step: node.step ?? 1, values: [value], onValueChange: ([v]) => b.write(node.value, v), thumbs: [{ "aria-labelledby": labelId, "aria-valuetext": fmt(value) }] }),
    h("div", { class: "pxd-range-bounds", "aria-hidden": "true" }, h("span", null, fmt(node.min)), h("span", null, fmt(node.max))),
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
export function Form(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const level = Math.min(ctx.heading, 6);
  const summaryId = ctx.id(node, "summary");
  const [problems, setProblems] = ctx.state<Problem[]>(node, "problems", () => []);
  const [marked] = ctx.state<{ current: Control[] }>(node, "marked", () => ({ current: [] }));
  // An asterisk has to say what it means, once, before the fields it marks.
  const anyRequired = (node.children ?? []).some((id: string) => r.byId.get(id)?.required);

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
    const el = document.getElementById(id) as Control | null;
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.focus();
    if (document.activeElement !== el) el.closest(".pxd-field")?.querySelector<HTMLElement>("[role='radio'], button, input:not([aria-hidden]), textarea, select")?.focus();
  };
  // Focus moves to the summary when the problems change, not on every redraw while they stand.
  const [announced, setAnnounced] = ctx.state<Problem[] | null>(node, "announced", null);
  if (problems !== announced) {
    setAnnounced(problems);
    if (problems.length) ctx.after(() => r.root?.querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(node.id)}"] .pxd-error-summary`)?.focus());
  }

  return h(
    "form",
    {
      class: `pxd-form${node.aside ? " pxd-form-with-aside" : ""}${node.layout === "horizontal" ? " pxd-form-horizontal" : ""}`,
      novalidate: true,
      onSubmit: (e: Event) => {
        e.preventDefault();
        const form = e.currentTarget as HTMLFormElement;
        unmark();
        if (!form.checkValidity()) {
          const failed = collectProblems(form, summaryId);
          mark(failed);
          return setProblems(failed.map((c) => ({ id: c.id, label: controlName(c), message: c.validationMessage })));
        }
        setProblems([]);
        r.dispatch(node.submit.action, b.scope, node.id);
      },
      ...ctx.a11y(node),
    },
    node.aside && h("aside", { class: "pxd-form-aside" }, ctx.render(node.aside)),
    h(
      "div",
      { class: "pxd-stack pxd-form-fields" },
      problems.length > 0 &&
        h(
          "section",
          { class: "pxd-error-summary", role: "alert", tabindex: "-1", "aria-labelledby": summaryId },
          h(`h${level}`, { id: summaryId, class: "pxd-error-summary-title" }, "Check these fields before continuing"),
          h("ul", { class: "pxd-error-summary-list" }, ...problems.map((p) => h("li", { key: p.id }, h("a", { href: `#${p.id}`, class: "pxd-link", onClick: (e: Event) => (e.preventDefault(), goTo(p.id)) }, p.label ? `${p.label}: ${p.message}` : p.message)))),
        ),
      anyRequired && h("p", { class: "pxd-required-legend" }, h("span", { class: "pxd-required", "aria-hidden": "true" }, "*"), " ", "Required"),
      ...Children(ctx, node.children),
    ),
    h("div", { class: "pxd-action-bar" }, h("button", { type: "submit", class: "pxd-button pxd-button-primary" }, b.text(node.submit.label)), node.cancel && h("button", { type: "button", class: "pxd-button pxd-button-secondary", onClick: () => r.dispatch(node.cancel.action, b.scope, node.id) }, b.text(node.cancel.label))),
  );
}
