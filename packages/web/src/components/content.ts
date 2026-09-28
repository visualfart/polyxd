import {
  STATUS_ICON, absolute, asList, calendarMonth, childPointer, collectionItemValue as itemValue, collectionLayout, dateParts, formatValue, get, metricChange, monthToShow, moveItem, nearestSlide, orderedIndices,
  qrEncode, resolveFormat, richText, rowChangeAction, safeColor, shiftMonth, type Node, type RichToken, type Scope,
} from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Dialog, dialogClose } from "../primitives.ts";
import { Icon } from "./avatar.ts";
import { Heading } from "./structure.ts";
import { Paging } from "./table.ts";

/** A colour value shown as itself: a swatch beside the text. */
export function Swatch(value: string): VNode {
  const color = safeColor(value);
  return h("span", { class: `pxd-swatch${color ? "" : " pxd-swatch-unknown"}`, style: color ? { background: color } : undefined, "aria-hidden": "true" });
}

/** The rich-text tokens core parses, as elements; never injected as HTML. */
function richNodes(tokens: RichToken[]): VChild[] {
  return tokens.map((t) => {
    if (typeof t === "string") return t;
    if (t.kind === "code") return h("code", null, t.text);
    if (t.kind === "strong") return h("strong", null, ...richNodes(t.children));
    if (t.kind === "em") return h("em", null, ...richNodes(t.children));
    if (t.kind !== "link") return null;
    return t.href ? h("a", { href: t.href, rel: "noopener noreferrer" }, ...richNodes(t.children)) : h("span", null, ...richNodes(t.children));
  });
}

export function Text(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const a11y = ctx.a11y(node);
  const variant = node.variant ?? "body";
  const color = node.format?.type === "color";
  const content = (v: unknown, format = node.format): VChild[] => {
    const text = b.text(v, format);
    return format?.type === "color" ? [Swatch(text), text] : [text];
  };
  if (variant === "rich") return h("p", { class: "pxd-text pxd-text-body pxd-text-rich", ...a11y }, ...richNodes(richText(b.text(node.text))));
  if (variant === "quote") {
    return h("figure", { class: "pxd-text-quote", ...a11y }, h("blockquote", null, h("p", { class: "pxd-text pxd-text-body" }, ...content(node.text))), node.cite !== undefined && h("figcaption", { class: "pxd-text-cite" }, b.text(node.cite)));
  }
  if (variant === "list") {
    const pointer = node.items ? absolute(node.items.path, b.scope) : undefined;
    const entries = pointer ? asList(get(ctx.r.data, pointer)) : [];
    const intro = b.text(node.text);
    return h(
      "div",
      { class: "pxd-text-list", ...a11y },
      intro && h("p", { class: "pxd-text pxd-text-body" }, intro),
      h(
        node.ordered ? "ol" : "ul",
        { class: `pxd-text-list-items${node.ordered ? " pxd-text-list-ordered" : ""}` },
        ...entries.map((entry, i) => {
          const raw = node.itemPath && pointer ? get(ctx.r.data, absolute(node.itemPath, { pointer: childPointer(pointer, i) })) : entry;
          return h("li", { key: i }, ...content(raw));
        }),
      ),
    );
  }
  return h("p", { class: `pxd-text pxd-text-${variant}${color ? " pxd-text-color" : ""}`, ...a11y }, ...content(node.text));
}

export function Metric(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const label = b.text(node.label);
  const value = b.text(node.value, node.format);
  const change = node.change ? metricChange(b.value(node.change.value), node.change.favorable, resolveFormat(node.change.format, ctx.r.data, b.scope), ctx.r.locale) : undefined;
  const caption = node.caption !== undefined ? b.text(node.caption) : undefined;
  return h(
    "div",
    { class: "pxd-metric", role: "group", "aria-label": label, ...ctx.a11y(node) },
    h("div", { class: "pxd-metric-label" }, label),
    h("div", { class: "pxd-metric-value" }, value),
    change && h("div", { class: `pxd-metric-change pxd-data-${change.tone}` }, h("span", { "aria-hidden": "true" }, change.text), h("span", { class: "pxd-sr-only" }, change.spoken)),
    caption && h("div", { class: "pxd-metric-caption" }, caption),
  );
}

export function DetailList(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const receipt = node.variant === "receipt";
  const value = (item: any) => {
    const raw = b.value(item.value);
    // In a receipt, a zero charge reads as "Free".
    if (receipt && item.format?.type === "currency" && raw === 0 && !item.total) return { text: "Free", free: true, color: false };
    return { text: b.text(item.value, item.format), free: false, color: item.format?.type === "color" };
  };
  // The 'Change' link per row (GOV.UK summary list). The row's key travels with the context.
  const change = (item: any, label: string) =>
    node.rowAction ? h("button", { type: "button", class: "pxd-link pxd-detail-change", onClick: () => ctx.r.dispatch(rowChangeAction(node.rowAction, item.key ?? label), b.scope, node.id) }, "Change", h("span", { class: "pxd-sr-only" }, ` ${label}`)) : null;
  const rows = (node.items as any[]).filter((i) => !i.total);
  const totals = (node.items as any[]).filter((i) => i.total);
  return h(
    "div",
    { class: `pxd-detail-list${receipt ? " pxd-receipt" : ""}${node.layout === "grid" ? " pxd-detail-grid" : ""}${node.rowAction ? " pxd-detail-actions" : ""}`, ...ctx.a11y(node) },
    node.title !== undefined && Heading(ctx, "pxd-detail-title", b.text(node.title)),
    h(
      "dl",
      null,
      ...rows.map((item: any, i: number) => {
        const v = value(item);
        const label = b.text(item.label);
        return h("div", { class: "pxd-detail-row", key: item.key ?? i }, h("dt", null, label), h("dd", { class: v.free ? "pxd-free" : undefined }, v.color && Swatch(v.text), v.text), node.rowAction && h("dd", { class: "pxd-detail-row-action" }, change(item, label)));
      }),
      ...totals.map((item: any, i: number) => h("div", { class: "pxd-detail-row pxd-total", key: item.key ?? `t${i}` }, h("dt", null, b.text(item.label)), h("dd", null, value(item).text), node.rowAction && h("dd", { class: "pxd-detail-row-action" }))),
    ),
  );
}

export function Collection(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const r = ctx.r;
  const labelId = ctx.id(node, "label");
  const pointer = absolute(node.items.path, b.scope);
  const items = asList(get(r.data, pointer));
  const selection = node.selection ?? "none";
  const selected = selection !== "none" && node.selected ? b.value<unknown>(node.selected) : undefined;
  const isSelected = (v: unknown) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  const toggle = (v: unknown) => {
    if (!node.selected) return;
    if (selection === "single") return b.write(node.selected, v);
    const cur = Array.isArray(selected) ? selected : [];
    b.write(node.selected, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  const selectedCount = Array.isArray(selected) ? selected.length : 0;
  const label = b.text(node.label);
  const template = r.byId.get(node.items.componentId);
  const { grid, timeline, carousel, calendar } = collectionLayout(node, template);

  const reorderable = node.reorderable === true;
  const order = reorderable && node.order ? b.value<unknown[]>(node.order) : undefined;
  const values = items.map((item, i) => itemValue(item, i));
  const indices = orderedIndices(values, order);
  const move = (from: number, to: number) => {
    const next = node.order ? moveItem(indices, values, from, to) : undefined;
    if (next) b.write(node.order, next);
  };
  const [dragging, setDragging] = ctx.state<number | null>(node, "dragging", null);

  // Carousel: which item is in view, for the readout and the buttons.
  const [position, setPosition] = ctx.state<number>(node, "position", 0);
  const trackOf = () => r.root?.querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(node.id)}"] .pxd-carousel-track`);
  const slides = (el: HTMLElement) => Array.from(el.children) as HTMLElement[];
  const measure = (e: Event) => {
    const el = e.currentTarget as HTMLElement;
    setPosition(nearestSlide(slides(el).map((c) => c.offsetLeft - el.offsetLeft), el.scrollLeft));
  };
  const goTo = (i: number) => {
    const el = trackOf();
    const target = el && slides(el)[Math.max(0, Math.min(items.length - 1, i))];
    if (el && target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  // Calendar: the month shown starts at the first dated item (or today) and moves a month at a time.
  const dated = calendar ? items.map((_, i) => dateParts(node.datePath ? get(r.data, absolute(node.datePath, { pointer: childPointer(pointer, i) })) : undefined)) : [];
  const [month, setMonth] = ctx.state<{ y: number; m: number } | null>(node, "month", null);
  const shown = monthToShow(month, dated.find(Boolean));

  if (!items.length && node.empty) return ctx.render(node.empty);

  const selectInput = (v: unknown, name: string) =>
    h("input", { type: selection === "single" ? "radio" : "checkbox", class: "pxd-collection-select", name: selection === "single" ? `${node.id}-selection` : undefined, checked: isSelected(v), onChange: () => toggle(v), "aria-label": name });

  const itemEl = (i: number, pos: number) => {
    const v = values[i];
    const scope: Scope = { pointer: childPointer(pointer, i) };
    return h(
      "li",
      {
        key: String(v),
        class: `pxd-collection-item${dragging === pos ? " pxd-collection-dragging" : ""}`,
        draggable: reorderable || undefined,
        onDragstart: reorderable ? () => setDragging(pos) : undefined,
        onDragover: reorderable ? (e: Event) => e.preventDefault() : undefined,
        onDrop: reorderable
          ? () => {
              if (dragging !== null) move(dragging, pos);
              setDragging(null);
            }
          : undefined,
        onDragend: reorderable ? () => setDragging(null) : undefined,
      },
      reorderable &&
        h(
          "div",
          { class: "pxd-collection-reorder" },
          h("span", { class: "pxd-collection-handle", "aria-hidden": "true" }, Icon("menu", 16)),
          h("button", { type: "button", class: "pxd-icon-button pxd-collection-move", "aria-label": `Move item ${pos + 1} up`, disabled: pos === 0, onClick: () => move(pos, pos - 1) }, Icon("sortUp", 16)),
          h("button", { type: "button", class: "pxd-icon-button pxd-collection-move", "aria-label": `Move item ${pos + 1} down`, disabled: pos === items.length - 1, onClick: () => move(pos, pos + 1) }, Icon("sortDown", 16)),
        ),
      selection !== "none" && selectInput(v, `Select item ${pos + 1} of ${items.length}`),
      h("div", { class: "pxd-collection-content" }, ctx.render(node.items.componentId, scope)),
    );
  };

  const bulk =
    selection === "multiple" &&
    selectedCount > 0 &&
    h(
      "div",
      { class: "pxd-table-toolbar pxd-table-bulk", role: "toolbar", "aria-label": `Actions for ${selectedCount} selected` },
      h("p", { class: "pxd-bulk-count", "aria-live": "polite" }, `${selectedCount} selected`),
      node.bulkActions && ctx.render(node.bulkActions),
      h("button", { type: "button", class: "pxd-button pxd-button-tertiary", onClick: () => b.write(node.selected, []) }, "Cancel"),
    );

  let body: VChild;
  if (carousel) {
    body = h(
      "div",
      { class: "pxd-carousel", role: "group", "aria-roledescription": "carousel", "aria-labelledby": labelId },
      h("ul", { class: "pxd-collection-list pxd-carousel-track", "aria-labelledby": labelId, onScroll: measure }, ...indices.map((i, pos) => itemEl(i, pos))),
      h(
        "div",
        { class: "pxd-carousel-controls" },
        h("button", { type: "button", class: "pxd-icon-button", "aria-label": "Previous item", disabled: position <= 0, onClick: () => goTo(position - 1) }, Icon("chevronLeft", 18)),
        h("p", { class: "pxd-carousel-position", "aria-live": "polite" }, `${position + 1} of ${items.length}`),
        h("button", { type: "button", class: "pxd-icon-button", "aria-label": "Next item", disabled: position >= items.length - 1, onClick: () => goTo(position + 1) }, Icon("chevronRight", 18)),
      ),
    );
  } else if (calendar) {
    const { monthName, weekdays, weeks } = calendarMonth(shown, r.locale);
    const onDay = (d: number) => indices.filter((i) => dated[i] && dated[i]!.y === shown.y && dated[i]!.m === shown.m && dated[i]!.d === d);
    body = h(
      "div",
      { class: "pxd-calendar" },
      h(
        "div",
        { class: "pxd-calendar-header" },
        h("button", { type: "button", class: "pxd-icon-button", "aria-label": "Previous month", onClick: () => setMonth(shiftMonth(shown, -1)) }, Icon("chevronLeft", 18)),
        h("p", { class: "pxd-calendar-month", "aria-live": "polite" }, monthName),
        h("button", { type: "button", class: "pxd-icon-button", "aria-label": "Next month", onClick: () => setMonth(shiftMonth(shown, 1)) }, Icon("chevronRight", 18)),
      ),
      h(
        "table",
        { class: "pxd-calendar-grid" },
        h("caption", { class: "pxd-sr-only" }, `${label}, ${monthName}`),
        h("thead", null, h("tr", null, ...weekdays.map((w) => h("th", { key: w, scope: "col" }, w)))),
        h(
          "tbody",
          null,
          ...weeks.map((week, wi) =>
            h(
              "tr",
              { key: wi },
              ...week.map((d, di) =>
                d === null
                  ? h("td", { key: di, class: "pxd-calendar-empty" })
                  : h(
                      "td",
                      { key: di, class: `pxd-calendar-day${onDay(d).length ? " pxd-calendar-has-items" : ""}` },
                      h("span", { class: "pxd-calendar-date" }, d),
                      onDay(d).length > 0 &&
                        h(
                          "ul",
                          { class: "pxd-calendar-items" },
                          ...onDay(d).map((i) =>
                            h("li", { key: String(values[i]), class: "pxd-collection-item" }, selection !== "none" && selectInput(values[i], `Select item on ${d}`), h("div", { class: "pxd-collection-content" }, ctx.render(node.items.componentId, { pointer: childPointer(pointer, i) }))),
                          ),
                        ),
                    ),
              ),
            ),
          ),
        ),
      ),
    );
  } else {
    body = h("ul", { class: `pxd-collection-list${grid ? " pxd-collection-grid" : ""}${timeline ? " pxd-timeline" : ""}${reorderable ? " pxd-collection-reorderable" : ""}`, "aria-labelledby": labelId }, ...indices.map((i, pos) => itemEl(i, pos)));
  }

  return h(
    "div",
    { class: "pxd-collection", ...ctx.a11y(node) },
    h("div", { class: "pxd-collection-label", id: labelId }, `${label} `, h("span", { class: "pxd-count" }, `(${items.length})`)),
    bulk,
    body,
    node.page && Paging(node, ctx, items.length),
  );
}

type Picture = { src: string; alt: string };

/**
 * Media: an image by default; a video or audio player with native controls and a transcript; a
 * gallery of the host's images; or a QR code of a value, drawn here so no URL leaves the surface.
 */
export function Media(node: Node, ctx: Ctx): VChild {
  const b = ctx.b;
  const r = ctx.r;
  const a11y = ctx.a11y(node);
  // Which gallery picture the viewer shows (null when closed).
  const [open, setOpen] = ctx.state<number | null>(node, "open", null);
  const kind = node.kind ?? "image";
  const ref = node.src ? b.value<string>(node.src) : undefined;
  const url = ref ? r.props.resolveMedia?.(ref) : undefined;
  const alt = node.decorative ? "" : b.text(node.alt);
  const cls = `pxd-media pxd-media-${node.aspect ?? "auto"}`;

  if (kind === "qr") return QRCode(ctx, node, b.text(node.value), alt, a11y);

  if (kind === "gallery") {
    const pointer = node.items ? absolute(node.items.path, b.scope) : undefined;
    const entries = pointer ? asList(get(r.data, pointer)) : [];
    const items = entries.map((_, i) => {
      const scope: Scope = { pointer: childPointer(pointer!, i) };
      const imageRef = node.imagePath ? get(r.data, absolute(node.imagePath, scope)) : undefined;
      const src = imageRef ? r.props.resolveMedia?.(String(imageRef)) : undefined;
      const itemAlt = node.altPath ? String(get(r.data, absolute(node.altPath, scope)) ?? "") : "";
      return { src, alt: itemAlt };
    });
    // Only pictures that resolved can be opened; the viewer counts and moves among those.
    const pictures = items.filter((it): it is Picture => Boolean(it.src));
    if (open !== null && pictures[open]) GalleryViewer(ctx, node, alt, pictures, open, setOpen);
    return h(
      "ul",
      { class: "pxd-gallery", "aria-label": alt || undefined, ...a11y },
      ...items.map((it, i) => {
        const at = pictures.indexOf(it as Picture);
        return h(
          "li",
          { key: i },
          at >= 0
            ? h("button", { type: "button", class: "pxd-gallery-item", "aria-label": it.alt ? `Open ${it.alt}` : `Open image ${at + 1} of ${pictures.length}`, onClick: () => setOpen(at) }, h("img", { class: `${cls} pxd-gallery-image`, src: it.src, alt: it.alt }))
            : h("div", { class: `${cls} pxd-media-placeholder pxd-gallery-image`, role: "img", "aria-label": it.alt || undefined }),
        );
      }),
    );
  }

  if (kind === "video" || kind === "audio") {
    const transcript = node.transcript !== undefined ? b.text(node.transcript) : undefined;
    const posterRef = node.poster !== undefined ? b.text(node.poster) : undefined;
    const poster = posterRef ? r.props.resolveMedia?.(posterRef) : undefined;
    return h(
      "figure",
      { class: `pxd-media-player pxd-media-${kind}`, ...a11y },
      kind === "video"
        ? url
          ? h("video", { class: cls, controls: true, src: url, poster, "aria-label": alt || undefined })
          : h("div", { class: `${cls} pxd-media-placeholder`, role: "img", "aria-label": alt || undefined })
        : url
          ? h("audio", { class: "pxd-media-audio-player", controls: true, src: url, "aria-label": alt || undefined })
          : h("div", { class: "pxd-media-placeholder pxd-media-audio-placeholder", role: "img", "aria-label": alt || undefined }),
      alt && h("figcaption", { class: "pxd-media-caption" }, alt),
      transcript && h("details", { class: "pxd-media-transcript" }, h("summary", null, "Transcript"), h("p", { class: "pxd-text pxd-text-body" }, transcript)),
    );
  }

  if (!url) return h("div", { class: `${cls} pxd-media-placeholder`, role: node.decorative ? "presentation" : "img", "aria-label": alt || undefined });
  return h("img", { class: cls, src: url, alt, ...a11y });
}

/** A left or right chevron. */
const Arrow = (dir: "left" | "right") => h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, h("path", { d: dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6" }));

/** One gallery picture at a time, large, with previous/next and a counter. Arrow keys move; Escape closes. */
function GalleryViewer(ctx: Ctx, node: Node, name: string, pictures: Picture[], index: number, onIndex: (i: number | null) => void) {
  const n = pictures.length;
  const { src, alt } = pictures[index];
  const go = (i: number) => onIndex(Math.max(0, Math.min(n - 1, i)));
  const titleId = ctx.id(node, "viewer-title");
  const close = () => onIndex(null);
  // At either end the button just used goes disabled; focus moves to the other one rather than dying.
  ctx.after(() => {
    const active = document.activeElement as HTMLButtonElement | null;
    if (active?.disabled && active.classList.contains("pxd-viewer-step")) (active.nextElementSibling ?? active.previousElementSibling)?.dispatchEvent(new Event("noop")), ((active.nextElementSibling ?? active.previousElementSibling) as HTMLElement | null)?.focus();
  });
  ctx.portal(
    Dialog(
      { ctx, id: ctx.id(node, "viewer"), class: "pxd-viewer", onClose: close, props: { "aria-labelledby": titleId, onKeydown: (e: KeyboardEvent) => (e.key === "ArrowLeft" ? go(index - 1) : e.key === "ArrowRight" ? go(index + 1) : undefined) } },
      h("h2", { id: titleId, class: "pxd-sr-only" }, name || "Pictures"),
      h("div", { class: "pxd-viewer-bar" }, h("span", { class: "pxd-viewer-counter", "aria-live": "polite" }, `${index + 1} of ${n}`), dialogClose(close, { class: "pxd-icon-button pxd-viewer-close", "aria-label": "Close" }, Icon("close"))),
      h("figure", { class: "pxd-viewer-figure" }, h("img", { class: "pxd-viewer-image", src, alt }), alt && h("figcaption", { class: "pxd-viewer-caption" }, alt)),
      h(
        "div",
        { class: "pxd-viewer-bar pxd-viewer-nav" },
        h("button", { type: "button", class: "pxd-icon-button pxd-viewer-step", "aria-label": "Previous picture", disabled: index === 0, onClick: () => go(index - 1) }, Arrow("left")),
        h("button", { type: "button", class: "pxd-icon-button pxd-viewer-step", "aria-label": "Next picture", disabled: index === n - 1, onClick: () => go(index + 1) }, Arrow("right")),
      ),
    ),
  );
}

/** A QR code on a canvas, in the surface's text and surface colours; too long a value falls back to text. */
function QRCode(ctx: Ctx, node: Node, text: string, alt: string, a11y: Record<string, unknown>): VNode {
  const grid = text ? qrEncode(text) : undefined;
  if (!grid) return h("div", { class: "pxd-qr pxd-qr-placeholder", role: "img", "aria-label": alt || `QR code: ${text}`, ...a11y }, h("span", { class: "pxd-qr-mark", "aria-hidden": "true" }, "QR"), h("span", { class: "pxd-qr-text" }, text));
  const draw = (el: Element | null) => {
    const canvas = el as HTMLCanvasElement | null;
    if (!canvas || canvas.dataset.text === text) return;
    canvas.dataset.text = text;
    const scale = 4;
    const quiet = 4;
    const size = grid.length;
    canvas.width = canvas.height = (size + quiet * 2) * scale;
    const c = canvas.getContext("2d");
    if (!c) return;
    const style = getComputedStyle(canvas);
    const dark = style.getPropertyValue("--pxd-color-text-default").trim() || "#000";
    const light = style.getPropertyValue("--pxd-color-surface-default").trim() || "#fff";
    c.fillStyle = light;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = dark;
    grid.forEach((row, y) => row.forEach((on, x) => on && c.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale)));
  };
  ctx.after(() => draw(ctx.r.root?.querySelector(`canvas[data-pxd-id="${CSS.escape(node.id)}"]`) ?? null));
  return h("canvas", { class: "pxd-qr", role: "img", "aria-label": alt || `QR code: ${text}`, ...a11y, ref: draw });
}

/**
 * Status. 'undo' is a snackbar after a reversible action ran (announced politely, with Undo);
 * 'empty' gets an icon tile and may carry an ActionBar (one primary, one secondary).
 */
export function Status(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const urgent = node.kind === "error";
  const a11y = ctx.a11y(node);
  ctx.r.statusDrawn(node, ctx.scope);
  if (node.kind === "undo") {
    return h("div", { class: "pxd-snackbar", role: "status", ...a11y }, h("p", { class: "pxd-snackbar-text" }, b.text(node.title), node.message !== undefined && h("span", { class: "pxd-snackbar-message" }, ` ${b.text(node.message)}`)), node.action && ctx.render(node.action));
  }
  return h(
    "div",
    { class: `pxd-status pxd-status-${node.kind}${node.variant === "inline" ? " pxd-status-notice" : ""}`, role: urgent ? "alert" : "status", ...a11y },
    node.kind === "loading" ? h("span", { class: "pxd-spinner", "aria-hidden": "true" }) : h("span", { class: "pxd-status-icon", "aria-hidden": "true" }, Icon(node.icon ?? STATUS_ICON[node.kind], node.kind === "empty" ? 28 : 16)),
    h("div", { class: "pxd-status-body" }, h("p", { class: "pxd-status-title" }, b.text(node.title)), node.message !== undefined && h("p", { class: "pxd-status-message" }, b.text(node.message)), node.action && node.variant !== "inline" && h("div", { class: "pxd-status-action" }, ctx.render(node.action))),
    node.action && node.variant === "inline" && h("div", { class: "pxd-status-action" }, ctx.render(node.action)),
  );
}

export { formatValue };
