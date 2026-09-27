/**
 * What the preview draws with: the workspace's own design system when one is published (its
 * mapping turned into the --pxd-* variables the renderer reads), or one of the renderer's
 * built-in themes, loaded the first time it is picked.
 */
import { api, type RoleRow } from "../api.ts";

export const BUILTIN: { id: string; name: string }[] = [
  { id: "shadcn", name: "shadcn" }, { id: "material3", name: "Material 3" }, { id: "govuk", name: "GOV.UK" }, { id: "antd", name: "Ant Design" }, { id: "bootstrap", name: "Bootstrap" },
  { id: "carbon", name: "Carbon" }, { id: "chakra", name: "Chakra" }, { id: "fluent", name: "Fluent" }, { id: "mantine", name: "Mantine" }, { id: "polaris", name: "Polaris" },
  { id: "primer", name: "Primer" }, { id: "radix", name: "Radix" }, { id: "spectrum", name: "Spectrum" },
];

// Static specifiers, so the bundler makes one chunk per theme.
const LOADERS: Record<string, () => Promise<unknown>> = {
  antd: () => import("@polyxd/react/themes/antd.css"),
  bootstrap: () => import("@polyxd/react/themes/bootstrap.css"),
  carbon: () => import("@polyxd/react/themes/carbon.css"),
  chakra: () => import("@polyxd/react/themes/chakra.css"),
  fluent: () => import("@polyxd/react/themes/fluent.css"),
  govuk: () => import("@polyxd/react/themes/govuk.css"),
  mantine: () => import("@polyxd/react/themes/mantine.css"),
  material3: () => import("@polyxd/react/themes/material3.css"),
  polaris: () => import("@polyxd/react/themes/polaris.css"),
  primer: () => import("@polyxd/react/themes/primer.css"),
  radix: () => import("@polyxd/react/themes/radix.css"),
  shadcn: () => import("@polyxd/react/themes/shadcn.css"),
  spectrum: () => import("@polyxd/react/themes/spectrum.css"),
};
const loaded = new Map<string, Promise<unknown>>();
export function loadTheme(id: string): Promise<unknown> {
  if (!loaded.has(id)) loaded.set(id, (LOADERS[id] ?? (() => Promise.resolve()))());
  return loaded.get(id)!;
}

export interface WorkspaceTheme {
  name: string;
  /** --pxd-* variables per mode; dark is absent when the design system has no dark mode. */
  light: Record<string, string>;
  dark?: Record<string, string>;
}

/** The workspace's default design system with a live version, as variables; null when there is none yet. */
export async function workspaceTheme(slug: string): Promise<WorkspaceTheme | null> {
  const { designSystems } = await api<{ designSystems: { id: string; name: string; is_default: number }[] }>("GET", `/api/w/${slug}/design-systems`);
  const ds = designSystems.find((d) => d.is_default) ?? designSystems[0];
  if (!ds) return null;
  const detail = await api<{ versions: { id: string; status: string }[] }>("GET", `/api/w/${slug}/design-systems/${ds.id}`);
  const live = detail.versions.find((v) => v.status === "live");
  if (!live) return null;
  const { rows, modes } = await api<{ rows: RoleRow[]; modes: string[] }>("GET", `/api/w/${slug}/design-systems/${ds.id}/versions/${live.id}/mapping`);
  const lightMode = modes.find((m) => /light|day|default/i.test(m)) ?? modes[0];
  const darkMode = modes.find((m) => /dark|night/i.test(m));
  const vars = (mode: string) => {
    const out: Record<string, string> = {};
    for (const r of rows) {
      const v = r.values[mode];
      if (r.token && v) out[`--pxd-${r.role.replace(/\./g, "-")}`] = v;
    }
    return out;
  };
  return { name: ds.name, light: vars(lightMode), dark: darkMode ? vars(darkMode) : undefined };
}
