import { avatarTone, iconPath, initialsOf, isMediaRef } from "@polyxd/core";
import { h, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";

/** A person or thing's face: an image when the host can resolve the reference, otherwise initials. */
export function Avatar(ctx: Ctx, { value, name, size = 40 }: { value?: unknown; name: string; size?: number }): VNode {
  const ref = typeof value === "string" ? value : "";
  const url = isMediaRef(ref) ? ctx.r.props.resolveMedia?.(ref) : undefined;
  const initials = initialsOf(ref, name);
  const tone = avatarTone(name);
  return url
    ? h("img", { class: "pxd-avatar", src: url, alt: "", width: size, height: size, style: { width: size, height: size } })
    : h("span", { class: `pxd-avatar pxd-avatar-${tone}`, "aria-hidden": "true", style: { width: size, height: size, fontSize: Math.round(size * 0.38) } }, initials);
}

export function Icon(name: string, size = 20): VNode {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, h("path", { d: iconPath(name) }));
}
