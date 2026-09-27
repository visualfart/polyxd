/** The Polyxd mark, as drawn in brand/build.ts: a p, a squircle, a circle cut through. */
export function Mark({ size = 28, ink = "currentColor", accent = "var(--signal)" }: { size?: number; ink?: string; accent?: string }) {
  const hole = "M13.6 16a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path fillRule="evenodd" d={`M13 6h6a7 7 0 0 1 7 7v6a7 7 0 0 1-7 7h-6a7 7 0 0 1-7-7v-6a7 7 0 0 1 7-7z${hole}`} fill={ink} />
      <rect x="6" y="14" width="5" height="14" rx="2.5" fill={ink} />
      <path fillRule="evenodd" d={`M16 11.2C19.504 11.2 20.8 12.496 20.8 16S19.504 20.8 16 20.8 11.2 19.504 11.2 16 12.496 11.2 16 11.2z${hole}`} fill={accent} />
    </svg>
  );
}
