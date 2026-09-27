/** A Choice's (or a ColorInput's swatches') options, from literal options or host data. */
import { absolute, asList, childPointer, get, type Scope } from "./data.ts";
import type { Node } from "./document.ts";

export interface Option {
  value: string | number | boolean;
  label: string;
  description?: string;
  avatar?: unknown;
  recent?: boolean;
}

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
