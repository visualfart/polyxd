import { useId, useState, type FormEvent } from "react";
import { Checkbox, RadioGroup, Slider, Switch } from "radix-ui";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, childPointer, get } from "../data.ts";
import { currencySymbol, formatValue } from "../format.ts";
import { Render, useA11y } from "../surface.tsx";
import { Children } from "./structure.tsx";

/** Label + help + control, with help associated to the control. */
function Field({ label, help, required, children, id, helpId }: { label: string; help?: string; required?: boolean; children: React.ReactNode; id: string; helpId: string }) {
  return (
    <div className="pxd-field">
      <label className="pxd-field-label" htmlFor={id}>
        {label}
        {required && <span className="pxd-required" aria-hidden="true"> (required)</span>}
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
    <Field label={b.text(node.label)} help={help} required={node.required} id={id} helpId={helpId}>
      {control}
    </Field>
  );
}

interface Option {
  value: string | number | boolean;
  label: string;
  description?: string;
}

function useOptions(node: Node): Option[] {
  const b = useBindings();
  const s = useSurface();
  const o = node.options;
  if (Array.isArray(o)) return o.map((x: any) => ({ value: x.value, label: b.text(x.label), description: x.description !== undefined ? b.text(x.description) : undefined }));
  const pointer = absolute(o.path, b.scope);
  const items = (get(s.data, pointer) as unknown[]) ?? [];
  return items.map((_, i) => {
    const p = { pointer: childPointer(pointer, i) };
    const at = (path?: string) => (path ? get(s.data, absolute(path, p)) : undefined);
    return { value: at(o.valuePath) as string, label: String(at(o.labelPath) ?? ""), description: o.descriptionPath ? String(at(o.descriptionPath)) : undefined };
  });
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

/** Choice picks its control from the number and shape of options (see the Choice rendering rules). */
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
  const searchable = options.length > 10;
  const shown = searchable && query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;
  const segmented = !multiple && options.length <= 4 && options.every((o) => o.label.length <= 20 && !o.description);
  const a11y = useA11y(node);

  const search = searchable && (
    <input type="search" className="pxd-input pxd-choice-search" placeholder="Filter options" aria-label={`Filter ${b.text(node.label)}`} value={query} onChange={(e) => setQuery(e.target.value)} />
  );

  if (multiple) {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (v: unknown) => b.write(node.value, selected.some((x) => key(x) === key(v)) ? selected.filter((x) => key(x) !== key(v)) : [...selected, v]);
    return (
      <fieldset className="pxd-field pxd-choice" aria-describedby={help ? helpId : undefined} {...a11y}>
        <legend className="pxd-field-label" id={labelId}>
          {b.text(node.label)}
        </legend>
        {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
        {search}
        <div className={`pxd-choice-list${searchable ? " pxd-choice-scroll" : ""}`}>
          {shown.map((o) => {
            const cid = `${labelId}-${key(o.value)}`;
            return (
              <div className="pxd-choice-option" key={key(o.value)}>
                <Checkbox.Root
                  id={cid}
                  className="pxd-checkbox"
                  checked={selected.some((x) => key(x) === key(o.value))}
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
  return (
    <div className="pxd-field pxd-choice" {...a11y}>
      <div className="pxd-field-label" id={labelId}>
        {b.text(node.label)}
        {node.required && <span className="pxd-required" aria-hidden="true"> (required)</span>}
      </div>
      {help && <p className="pxd-field-help" id={helpId}>{help}</p>}
      {search}
      <RadioGroup.Root
        className={segmented ? "pxd-segmented" : `pxd-choice-list${searchable ? " pxd-choice-scroll" : ""}`}
        aria-labelledby={labelId}
        aria-describedby={help ? helpId : undefined}
        aria-required={node.required || undefined}
        value={current}
        onValueChange={(k) => b.write(node.value, options.find((o) => key(o.value) === k)?.value)}
        orientation={segmented ? "horizontal" : "vertical"}
      >
        {shown.map((o) => {
          const cid = `${labelId}-${key(o.value)}`;
          return segmented ? (
            <RadioGroup.Item key={key(o.value)} value={key(o.value)} className="pxd-segment">
              {o.label}
            </RadioGroup.Item>
          ) : (
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

const DATE_TYPE: Record<string, string> = { date: "date", time: "time", datetime: "datetime-local" };

/** Native date/time inputs: typing is always possible, and pickers are platform-native. */
export function DateInput({ node }: { node: Node }) {
  const b = useBindings();
  const id = useId();
  const helpId = useId();
  const kind = node.kind ?? "date";
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const value = b.value<unknown>(node.value);
  const min = node.min !== undefined ? b.text(node.min) : undefined;
  const max = node.max !== undefined ? b.text(node.max) : undefined;
  const a11y = useA11y(node);
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
        className="pxd-input pxd-input-date"
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
  const value = Number(b.value(node.value) ?? node.min);
  const fmt = (n: number) => formatValue(n, resolveFormat(node.format ?? { type: "number" }, s.data, b.scope), s.locale);
  return (
    <div className="pxd-field pxd-range" {...useA11y(node)}>
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

export function Form({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  return (
    <form
      className="pxd-form"
      onSubmit={(e) => {
        e.preventDefault();
        s.dispatch(node.submit.action, b.scope, node.id);
      }}
      {...useA11y(node)}
    >
      <div className="pxd-stack">
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
