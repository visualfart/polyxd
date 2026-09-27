/**
 * The Export menu: six shapes of the same version, each a link to the API (the session cookie or
 * an API key reads it), with a line on what the file is for. A draft says it carries a banner.
 */
import type { Ws } from "../App.tsx";

export const FORMAT_INFO: { id: string; title: string; file: string; what: string }[] = [
  { id: "css", title: "CSS variables", file: "name.css", what: "The --pxd-* variables per mode, exactly as @polyxd/react's themes are built, plus shadcn/ui's names. Drop it in with styles.css and set data-pxd-theme." },
  { id: "dtcg", title: "Design tokens pack (DTCG)", file: "name.pack.json", what: "The pack itself: a manifest and the token files, as one JSON bundle. Write the files out and it checks with polyxd check." },
  { id: "tailwind", title: "Tailwind theme", file: "name.tailwind.config.js", what: "A theme.extend that maps colours, spacing, radii, fonts, shadows and motion to the roles, through the CSS variables." },
  { id: "style-dictionary", title: "Style Dictionary v4", file: "name.tokens.json", what: "A DTCG source with one tree per mode, every role typed, for your own platform builds." },
  { id: "swift", title: "Swift (SwiftUI)", file: "NameTokens.swift", what: "An enum per mode: Color, CGFloat, typography and shadow values for every role." },
  { id: "compose", title: "Kotlin (Compose)", file: "NameTokens.kt", what: "An object per mode: Color(0xFF…), .dp, .sp and easing values for every role." },
];

export function ExportMenu({ ws, dsId, version, onClose }: { ws: Ws; dsId: string; version: { id: string; number: number; status: string }; onClose: () => void }) {
  const base = `/api/w/${ws.slug}/design-systems/${dsId}/versions/${version.id}/export`;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Export" style={{ width: 560 }}>
        <header>
          <div style={{ flexGrow: 1 }}><h2>Export v{version.number}</h2><p className="small muted" style={{ marginTop: 4 }}>{version.status === "live" ? "Published: what your code gets is what screens are drawn with." : "A draft: every file starts with a banner saying so. Publish the version before shipping it."}</p></div>
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </header>
        <div className="body" style={{ gap: 10 }}>
          {FORMAT_INFO.map((f) => (
            <a key={f.id} className="choice-card" href={`${base}?format=${f.id}&download=1`} download style={{ textDecoration: "none", alignItems: "center" }}>
              <span style={{ flexGrow: 1, minWidth: 0 }}><b>{f.title} <span className="mono muted" style={{ fontWeight: 400, fontSize: 12 }}>{f.file}</span></b><span>{f.what}</span></span>
              <span className="btn sm" aria-hidden="true">Download</span>
            </a>
          ))}
          <div className="notice gray"><div className="body"><b>From your build</b><code className="mono" style={{ wordBreak: "break-all" }}>curl -H "Authorization: Bearer $POLYXD_STUDIO_KEY" {location.origin}{base}?format=css</code><div style={{ marginTop: 6 }}>An API key from Team → API keys reads any version; the response carries X-Polyxd-Design-System-Version and -Status.</div></div></div>
        </div>
      </div>
    </>
  );
}
