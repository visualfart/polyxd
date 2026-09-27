import { IDENTITY_SIZE, STAR_PATH, absolute, asList, childPointer, contextWithValue, formatValue, gaugeState, get, groupSummary, maskSecret, ratingSaid, resolveFormat, starsLabel, type Node } from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { RadioGroup, RadioItem } from "../primitives.ts";
import { Avatar, Icon } from "./avatar.ts";

/** Dispatch an input's action with the value it just wrote applied (as Toggle does). */
function dispatchWithValue(ctx: Ctx, node: Node, next: unknown) {
  if (!node.action) return;
  ctx.r.dispatch({ event: { name: node.action.event.name, context: contextWithValue(node, ctx.r.data, ctx.scope, next) } }, { pointer: "" }, node.id);
}

/**
 * A short label, status or count. A status is coloured by tone but its label carries the meaning;
 * a count is a number whose label is its accessible name ("Inbox: 12"); a removable tag has a
 * button named "Remove <label>".
 */
export function Tag(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const label = b.text(node.label);
  const kind: string = node.kind ?? "label";
  const tone: string = kind === "status" ? node.tone ?? "neutral" : "neutral";
  const a11y = ctx.a11y(node);
  const cls = `pxd-tag pxd-tag-${kind} pxd-tag-${tone}${node.remove ? " pxd-tag-removable" : ""}`;
  if (kind === "count") return h("span", { class: cls, title: label, ...a11y }, h("span", { class: "pxd-sr-only" }, `${label}: `), h("span", { class: "pxd-tag-number" }, b.text(node.count, { type: "number" })));
  return h("span", { class: cls, title: label, ...a11y }, h("span", { class: "pxd-tag-text" }, label), node.remove && h("button", { type: "button", class: "pxd-tag-remove", "aria-label": `Remove ${label}`, onClick: () => ctx.r.dispatch(node.remove, b.scope, node.id) }, Icon("close", 12)));
}

/**
 * A person, team or organisation: picture, name and a line of detail; or a group of them as
 * overlapping pictures with "+N" for the rest. With an action, the whole element is one button
 * named by the name.
 */
export function Identity(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const nameId = ctx.id(node, "name");
  const detailId = ctx.id(node, "detail");
  const a11y = ctx.a11y(node);
  const kind: string = node.kind ?? "person";
  const sizeName: string = node.size ?? "default";
  const size = IDENTITY_SIZE[sizeName] ?? IDENTITY_SIZE.default;
  const name = b.text(node.name);
  const detail = node.detail !== undefined ? b.text(node.detail) : undefined;
  const style = { "--polyxd-identity-size": `${size}px` };
  const cls = `pxd-identity pxd-identity-${sizeName} pxd-identity-${kind}${node.group ? " pxd-identity-group" : ""}`;
  let faces: VChild;
  let summary = name;
  if (node.group) {
    const pointer = absolute(node.group.path, b.scope);
    const members = asList(get(r.data, pointer)).map((_, i) => {
      const scope = { pointer: childPointer(pointer, i) };
      const at = (path?: string) => (path ? get(r.data, absolute(path, scope)) : undefined);
      return { name: String(at(node.group.namePath) ?? ""), image: at(node.group.imagePath) };
    });
    const max: number = node.group.max ?? 4;
    const shown = members.slice(0, max);
    const rest = members.slice(max);
    // The host's summary names the group; without one, list the first names and how many more.
    if (!summary) summary = groupSummary(members, max);
    faces = h(
      "span",
      { class: "pxd-identity-faces" },
      ...shown.map((m, i) => h("span", { class: "pxd-identity-face", key: i }, Avatar(ctx, { value: m.image, name: m.name, size }), h("span", { class: "pxd-sr-only" }, m.name))),
      rest.length > 0 && h("span", { class: "pxd-identity-face pxd-identity-more", role: "img", title: rest.map((m) => m.name).join(", "), "aria-label": `${rest.length} more: ${rest.map((m) => m.name).join(", ")}` }, h("span", { "aria-hidden": "true" }, `+${rest.length}`)),
    );
  } else faces = Avatar(ctx, { value: b.value(node.image), name, size });
  const body = [faces, h("span", { class: "pxd-identity-text" }, h("span", { class: "pxd-identity-name", id: nameId }, summary), detail && h("span", { class: "pxd-identity-detail", id: detailId }, detail))];
  if (node.action) return h("button", { type: "button", class: `${cls} pxd-identity-button`, style, "aria-labelledby": nameId, "aria-describedby": detail ? detailId : undefined, onClick: () => r.dispatch(node.action, b.scope, node.id), ...a11y }, ...body);
  return h("div", { class: cls, style, role: "group", "aria-labelledby": nameId, "aria-describedby": detail ? detailId : undefined, ...a11y }, ...body);
}

/**
 * A bar or ring (progress towards done: role progressbar) or a meter (an amount within bounds:
 * role meter, tone by threshold). The readout is text beside the graphic; an indeterminate bar
 * has no value and is busy.
 */
export function Progress(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const labelId = ctx.id(node, "label");
  const a11y = ctx.a11y(node);
  const kind: string = node.kind ?? "bar";
  const label = b.text(node.label);
  const caption = node.caption !== undefined ? b.text(node.caption) : undefined;
  const g = gaugeState({ kind, thresholds: node.thresholds, tone: node.tone, format: resolveFormat(node.format, ctx.r.data, b.scope) }, b.value(node.value), node.max !== undefined ? b.value(node.max) : undefined, Boolean(b.value(node.indeterminate)), caption, ctx.r.locale);
  const role = kind === "meter" ? "meter" : "progressbar";
  const cls = `pxd-gauge pxd-gauge-${kind}${g.tone && g.tone !== "neutral" ? ` pxd-gauge-${g.tone}` : ""}${g.indeterminate ? " pxd-gauge-indeterminate" : ""}`;
  const text = h("div", { class: "pxd-gauge-header" }, h("span", { class: "pxd-gauge-label", id: labelId }, label), h("span", { class: "pxd-gauge-readout" }, !g.indeterminate && h("span", { class: "pxd-gauge-value" }, g.readout), caption && h("span", { class: "pxd-gauge-caption" }, caption), g.hint && h("span", { class: "pxd-gauge-hint" }, g.hint)));
  if (kind === "ring") {
    return h(
      "div",
      { class: cls, ...a11y },
      h("div", { class: "pxd-gauge-ring-graphic", role, "aria-labelledby": labelId, ...g.valueProps }, h("svg", { class: "pxd-gauge-ring-svg", viewBox: "0 0 36 36", "aria-hidden": "true", focusable: "false" }, h("circle", { class: "pxd-gauge-ring-track", cx: "18", cy: "18", r: "16", fill: "none", "stroke-width": "4" }), h("circle", { class: "pxd-gauge-ring-fill", cx: "18", cy: "18", r: "16", fill: "none", "stroke-width": "4", pathLength: 100, "stroke-dasharray": g.indeterminate ? "25 100" : `${g.percent} 100`, "stroke-linecap": "round" }))),
      text,
    );
  }
  return h("div", { class: cls, ...a11y }, text, h("div", { class: "pxd-gauge-track", role, "aria-labelledby": labelId, ...g.valueProps }, h("div", { class: "pxd-gauge-fill", style: g.indeterminate ? undefined : { width: `${g.percent}%` } })));
}

/** One star shape, filled to a fraction (so 4.6 shows a 60% fifth star). */
function Star(fill: number): VNode {
  const pct = Math.round(Math.max(0, Math.min(1, fill)) * 100);
  return h("span", { class: "pxd-rating-star-shape", "aria-hidden": "true" }, h("svg", { class: "pxd-rating-star-empty", viewBox: "0 0 24 24", focusable: "false" }, h("path", { d: STAR_PATH })), h("span", { class: "pxd-rating-star-fill", style: { width: `${pct}%` } }, h("svg", { viewBox: "0 0 24 24", focusable: "false" }, h("path", { d: STAR_PATH }))));
}

/**
 * A score out of N. Given by the person: a radiogroup of radios named "1 star" to "N stars",
 * each a real control at the minimum target size. Read-only: an image named "4.6 out of 5" with
 * the score as text beside it.
 */
export function Rating(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const labelId = ctx.id(node, "label");
  const helpId = ctx.id(node, "help");
  const [hover, setHover] = ctx.state<number | null>(node, "hover", null);
  const a11y = ctx.a11y(node);
  const max: number = node.max ?? 5;
  const label = b.text(node.label);
  const raw = b.value<unknown>(node.value);
  const value = raw === null || raw === undefined || raw === "" ? undefined : Number(raw);
  const score = value !== undefined && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : undefined;
  const readOnly = Boolean(b.value(node.readOnly));
  const count = node.count !== undefined ? b.value<unknown>(node.count) : undefined;
  const countText = count !== undefined && count !== null ? formatValue(count, { type: "number" }, r.locale) : undefined;
  const help = node.help !== undefined ? b.text(node.help) : undefined;
  const scoreText = score !== undefined ? formatValue(score, { type: "number", precision: Number.isInteger(score) ? 0 : 1 }, r.locale) : undefined;
  const countSpoken = count !== undefined && count !== null ? `from ${countText} ${Number(count) === 1 ? "rating" : "ratings"}` : undefined;

  if (readOnly) {
    return h(
      "div",
      { class: "pxd-rating pxd-rating-readonly", ...a11y },
      h("span", { class: "pxd-rating-label" }, label),
      h("span", { class: "pxd-rating-stars", role: "img", "aria-label": ratingSaid(scoreText, max) }, ...Array.from({ length: max }, (_, i) => Star((score ?? 0) - i))),
      h("span", { class: "pxd-rating-readout" }, scoreText && h("span", { class: "pxd-rating-value", "aria-hidden": "true" }, scoreText), countText && h("span", { class: "pxd-rating-count" }, h("span", { "aria-hidden": "true" }, `(${countText})`), h("span", { class: "pxd-sr-only" }, countSpoken))),
    );
  }
  const current = score !== undefined ? Math.round(score) : 0;
  const shown = hover ?? current;
  const rate = (v: string) => {
    const n = Number(v);
    b.write(node.value, n);
    dispatchWithValue(ctx, node, n);
  };
  return h(
    "div",
    { class: "pxd-field pxd-rating", ...a11y },
    h("div", { class: "pxd-field-label", id: labelId }, label, node.required && h("span", { class: "pxd-required", "aria-hidden": "true" }, "*")),
    help && h("p", { class: "pxd-field-help", id: helpId }, help),
    h(
      "div",
      { class: "pxd-rating-row" },
      RadioGroup(
        { class: "pxd-rating-stars", orientation: "horizontal", "aria-labelledby": labelId, "aria-describedby": help ? helpId : undefined, "aria-required": node.required || undefined, value: current ? String(current) : "", onValueChange: rate, onMouseleave: () => setHover(null) },
        ...Array.from({ length: max }, (_, i) => i + 1).map((n) => RadioItem({ key: n, value: String(n), group: current ? String(current) : "", first: n === 1, onSelect: () => rate(String(n)), class: `pxd-rating-star${n <= shown ? " pxd-rating-star-on" : ""}`, "aria-label": starsLabel(n), "data-orientation": "horizontal", onMouseenter: () => setHover(n), onFocus: () => setHover(null) }, Star(n <= shown ? 1 : 0))),
      ),
      h("span", { class: "pxd-rating-readout", "aria-hidden": "true" }, scoreText && h("span", { class: "pxd-rating-value" }, scoreText), countText && h("span", { class: "pxd-rating-count" }, `(${countText})`)),
      countSpoken && h("span", { class: "pxd-sr-only" }, countSpoken),
    ),
  );
}

const COPIED_FOR = 2000;

/**
 * Code, a command or preformatted text: a region named by its label holding pre > code, with a
 * Copy button that announces "Copied". A secret is masked to the same length until shown.
 */
export function Code(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const labelId = ctx.id(node, "label");
  const a11y = ctx.a11y(node);
  const text = b.text(node.text);
  const label = node.label !== undefined ? b.text(node.label) : undefined;
  const secret = Boolean(b.value(node.secret));
  const copyable = node.copyable !== false;
  const [revealed, setRevealed] = ctx.state<boolean>(node, "revealed", false);
  const [status, setStatus] = ctx.state<"" | "Copied" | "Couldn't copy">(node, "status", "");
  const [timer] = ctx.state<{ id: ReturnType<typeof setTimeout> | null }>(node, "timer", () => ({ id: null }));
  const announce = (next: "Copied" | "Couldn't copy") => {
    setStatus(next);
    if (timer.id) clearTimeout(timer.id);
    timer.id = setTimeout(() => setStatus(""), COPIED_FOR);
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
  return h(
    "section",
    { class: `pxd-code${node.wrap ? " pxd-code-wrap" : ""}${secret ? " pxd-code-secret" : ""}`, "aria-labelledby": label !== undefined ? labelId : undefined, "aria-label": label === undefined ? name : undefined, ...a11y },
    h(
      "div",
      { class: "pxd-code-header" },
      label !== undefined && h("span", { class: "pxd-code-label", id: labelId }, label),
      h(
        "div",
        { class: "pxd-code-controls" },
        secret && h("button", { type: "button", class: "pxd-button pxd-button-tertiary pxd-code-control", "aria-label": `${revealed ? "Hide" : "Show"} ${what}`, onClick: () => setRevealed(!revealed) }, revealed ? "Hide" : "Show"),
        copyable && h("button", { type: "button", class: "pxd-button pxd-button-tertiary pxd-code-control", "aria-label": `Copy ${what}`, onClick: copy }, status === "Copied" && Icon("check", 16), status === "Copied" ? "Copied" : "Copy"),
        h("span", { class: "pxd-sr-only", role: "status", "aria-live": "polite" }, status),
      ),
    ),
    h("pre", { class: "pxd-code-pre", tabindex: "0", "data-language": node.language, "data-masked": masked || undefined }, h("code", { class: node.language ? `language-${node.language}` : undefined, translate: "no" }, shown)),
  );
}
