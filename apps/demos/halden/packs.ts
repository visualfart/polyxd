/** The design systems the "Under the hood" drawer can show a surface in; the product only ships its own. */
export const PACKS = [
  ["material3", "Material 3"],
  ["shadcn", "shadcn/ui"],
  ["carbon", "Carbon"],
  ["polaris", "Polaris"],
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

export const loadPack = async (id: string) => {
  const load = themeFiles[`../../../packages/react/themes/${id}.css`];
  if (load) await load();
};
