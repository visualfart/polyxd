/**
 * A pack's logo, as its manifest names it (packages/ds-<id>/logo.svg): the owner's official file for
 * a real design system whose guidelines allow it, a Polyxd-made mark for a template. Packs named in
 * words only (GOV.UK, whose crown and logotype are protected) have no file and draw nothing.
 */
const files = import.meta.glob<string>("../../../../packages/ds-*/logo.{svg,png}", { eager: true, query: "?url", import: "default" });

export const packLogoUrl = (id: string) => Object.entries(files).find(([path]) => path.includes(`/ds-${id}/logo.`))?.[1];

/** The logo on a white squircle tile with a hairline, the same in both themes so it keeps its own colours. Decorative: the name beside it is the label. */
export function PackLogo({ id, size = 24 }: { id: string; size?: number }) {
  const src = packLogoUrl(id);
  if (!src) return null;
  return (
    <span className="pack-logo" aria-hidden="true" style={{ width: size, height: size, padding: Math.round(size * 0.14) }}>
      <img src={src} alt="" width={size} height={size} decoding="async" />
    </span>
  );
}
