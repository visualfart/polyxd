/** The design systems the "Under the hood" drawer can show a surface in; Quay's own is Polaris. */
export const PACKS = [
  ["polaris", "Polaris"],
  ["shadcn", "shadcn/ui"],
  ["material3", "Material 3"],
  ["carbon", "Carbon"],
  ["antd", "Ant Design"],
  ["govuk", "GOV.UK"],
  ["fluent", "Fluent 2"],
  ["primer", "Primer"],
  ["spectrum", "Spectrum 2"],
  ["chakra", "Chakra"],
  ["mantine", "Mantine"],
  ["radix", "Radix Themes"],
  ["bootstrap", "Bootstrap"],
].map(([id, name]) => ({ id, name }));

const themeFiles = import.meta.glob("../../../packages/react/themes/*.css");

/** Loads a pack's theme CSS on demand: the product only ships its own. */
export const loadPack = async (id: string) => {
  const load = themeFiles[`../../../packages/react/themes/${id}.css`];
  if (load) await load();
};
