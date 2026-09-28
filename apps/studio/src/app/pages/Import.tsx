import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Scan } from "../api.ts";
import { track } from "../analytics.ts";
import { Page, type Ws } from "../App.tsx";

type Source = "package" | "file" | "tarball";

interface Registry { id: string; url: string; scope: string; has_token: number }

export function Import({ ws }: { ws: Ws }) {
  const navigate = useNavigate();
  const [source, setSource] = useState<Source>("package");
  const [pkg, setPkg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [showRegistry, setShowRegistry] = useState(false);
  const [reg, setReg] = useState({ url: "https://npm.pkg.github.com", scope: "", token: "" });
  const loadRegs = () => api<{ registries: Registry[] }>("GET", `/api/w/${ws.slug}/registries`).then((r) => setRegistries(r.registries));
  useEffect(() => {
    loadRegs();
  }, [ws.slug]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      if (name) fd.set("name", name);
      if (source === "package") fd.set("package", pkg);
      else if (file) fd.set("file", file);
      const r = await api<{ designSystemId: string; versionId: string; scan: Scan }>("POST", `/api/w/${ws.slug}/design-systems/import`, fd);
      // The kind of source only: never the file's or the package's name.
      track("design_system_imported", { source: source === "package" ? "package" : /\.css$/i.test(file?.name ?? "") ? "css" : /\.(tgz|tar\.gz)$/i.test(file?.name ?? "") ? "tarball" : "json" }, ws.id);
      navigate(`/w/${ws.slug}/design-systems/${r.designSystemId}/versions/${r.versionId}/scan`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveRegistry = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("POST", `/api/w/${ws.slug}/registries`, reg);
      setReg({ url: "https://npm.pkg.github.com", scope: "", token: "" });
      setShowRegistry(false);
      loadRegs();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const options: { id: Source; title: string; sub: string }[] = [
    { id: "package", title: "An npm package", sub: "The package your design system ships as: @acme/tokens, or @acme/design-system. Public, or private with a registry token." },
    { id: "tarball", title: "A packed package (.tgz)", sub: "Run npm pack on your machine and upload the result. No credential leaves your company." },
    { id: "file", title: "A token file", sub: "Tokens Studio JSON, W3C design tokens (DTCG), or your tokens.css." },
  ];

  return (
    <Page crumbs={[ws.name, "Design systems", "Import"]} title="Import a design system" lede="Bring your tokens as they are: primitives, semantic tokens and component tokens, of every type, in every mode. Studio reads them, shows what it found, then maps Polyxd's roles onto your semantic tier for you to check.">
      <form onSubmit={submit} className="split">
        <div style={{ width: 460, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ marginBottom: 4 }}>1. Where are your tokens?</h2>
          {options.map((o) => (
            <label key={o.id} className="choice-card" data-on={source === o.id}>
              <input type="radio" name="source" value={o.id} checked={source === o.id} onChange={() => setSource(o.id)} style={{ margin: "3px 0 0", accentColor: "var(--ink)" }} />
              <span><b>{o.title}</b><span>{o.sub}</span></span>
            </label>
          ))}
          <div className="notice gray" style={{ marginTop: 8 }}>
            <div className="body"><b>Inside your own network?</b>Make an API key on the Team page and run <code className="mono">npx polyxd studio push ./</code> in the package; nothing about your registry reaches Studio.</div>
          </div>
        </div>
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 style={{ marginBottom: 4 }}>2. {source === "package" ? "Which package" : "Your file"}</h2>
          {source === "package" && (
            <>
              <div className="field">
                <label htmlFor="pkg">Package</label>
                <input id="pkg" className="input mono" placeholder="@acme/design-tokens@2.3.0" value={pkg} onChange={(e) => setPkg(e.target.value)} required autoFocus />
                <span className="help">A version is optional; latest is used without one.</span>
              </div>
              <div className="card" style={{ gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2>Private registries</h2>
                  <button type="button" className="btn sm" onClick={() => setShowRegistry((s) => !s)}>{showRegistry ? "Cancel" : "Add a registry"}</button>
                </div>
                {!registries.length && !showRegistry && <p className="small muted">Public npm needs nothing. For GitHub Packages, Artifactory or a private npm scope, add a read-only token here. It's stored encrypted and never shown again.</p>}
                {registries.map((r) => (
                  <div key={r.id} className="small" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="mono">{r.url}</span>
                    {r.scope && <span className="tag">{r.scope}</span>}
                    <span className={`tag ${r.has_token ? "ok" : ""}`}>{r.has_token ? "token saved" : "no token"}</span>
                    <button type="button" className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={async () => { await api("DELETE", `/api/w/${ws.slug}/registries/${r.id}`); loadRegs(); }}>Remove</button>
                  </div>
                ))}
                {showRegistry && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--soft)", paddingTop: 10 }}>
                    <div className="field"><label htmlFor="rurl">Registry URL</label><input id="rurl" className="input mono" value={reg.url} onChange={(e) => setReg({ ...reg, url: e.target.value })} /></div>
                    <div className="field"><label htmlFor="rscope">Scope <span className="muted">(optional)</span></label><input id="rscope" className="input mono" placeholder="@acme" value={reg.scope} onChange={(e) => setReg({ ...reg, scope: e.target.value })} /><span className="help">Only packages under this scope use this registry.</span></div>
                    <div className="field"><label htmlFor="rtoken">Read-only token</label><input id="rtoken" className="input mono" type="password" value={reg.token} onChange={(e) => setReg({ ...reg, token: e.target.value })} autoComplete="off" /><span className="help">A token with read access to packages only. Encrypted at rest; remove the registry to revoke.</span></div>
                    <div><button type="button" className="btn" onClick={saveRegistry}>Save registry</button></div>
                  </div>
                )}
              </div>
            </>
          )}
          {source !== "package" && (
            <div className="dropzone">
              <b>{source === "tarball" ? "Choose the .tgz from npm pack" : "Choose a .json or .css file"}</b>
              <span className="small muted">{source === "tarball" ? "Studio unpacks it and finds the token files inside." : "A .json file from Tokens Studio or any DTCG export, or a stylesheet of custom properties."}</span>
              <input type="file" accept={source === "tarball" ? ".tgz,.tar.gz" : ".json,.css,.tokens.json"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
              {file && <span className="small">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
            </div>
          )}
          <div className="field"><label htmlFor="dsname">Name this design system <span className="muted">(optional)</span></label><input id="dsname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={source === "package" ? "the package's name" : "the file's name"} /></div>
          <div className="notice gray"><div className="body"><b>Nothing is used until you've checked it</b>Studio scans the file first, then shows every mapping before a single screen draws with it.</div></div>
          {error && <div className="notice bad" role="alert"><div className="body"><b>Couldn't import</b>{error}</div></div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? "Reading…" : "Scan tokens"}</button>
          </div>
        </div>
      </form>
    </Page>
  );
}
