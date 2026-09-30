import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { track } from "../analytics.ts";
import { useSession } from "../App.tsx";
import { StudioLockup } from "../mark.tsx";

export function Workspaces() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(me.workspaces.length === 0);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const w = await api<{ id: string; slug: string }>("POST", "/api/workspaces", { name, slug: slug || name });
      track("workspace_created", {}, w.id);
      await refresh();
      navigate(`/w/${w.slug}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="auth">
      <main>
        <div className="auth-top">
          <StudioLockup size={26} />
          <span className="small muted">
            {me.admin && (
              <>
                <Link to="/admin">Support</Link> ·{" "}
              </>
            )}
            {me.user?.email}
          </span>
        </div>
        <div className="form" style={{ width: 560 }}>
          {creating ? (
            <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <h1>Tell us about your product</h1>
                <p className="muted" style={{ marginTop: 8 }}>Studio sets up a workspace for one product. Everything here can be changed later.</p>
              </div>
              <div className="field"><label htmlFor="pname">Product name</label><input id="pname" className="input" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(""); }} required autoFocus /></div>
              <div className="field">
                <label htmlFor="pslug">Workspace address</label>
                <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-pill)", height: 44, background: "var(--surface)" }}>
                  <span className="muted" style={{ padding: "0 0 0 16px", whiteSpace: "nowrap" }}>studio.polyxd.com/</span>
                  <input id="pslug" className="input" style={{ border: 0, height: 41, background: "transparent", paddingLeft: 2 }} value={slug} placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} onChange={(e) => setSlug(e.target.value)} />
                </div>
                <span className="help">Your team signs in here.</span>
              </div>
              {error && <p style={{ color: "var(--bad)" }}>{error}</p>}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {me.workspaces.length > 0 ? <button type="button" className="btn ghost" onClick={() => setCreating(false)}>Back</button> : <span />}
                <button className="btn primary" type="submit">Create workspace</button>
              </div>
            </form>
          ) : (
            <>
              <h1>Your workspaces</h1>
              <ul className="list">
                {me.workspaces.map((w) => (
                  <li key={w.id}>
                    <Link to={`/w/${w.slug}`} style={{ flexGrow: 1, color: "var(--ink)", fontWeight: 600 }}>{w.name}</Link>
                    <span className="small muted">{w.role}</span>
                  </li>
                ))}
              </ul>
              <div><button type="button" className="btn" onClick={() => setCreating(true)}>Create another workspace</button></div>
            </>
          )}
        </div>
      </main>
      <aside>
        <p>One workspace per product.</p>
        <p>Its design systems, components, rules and reviews live together, and the people who own them sign in here.</p>
      </aside>
    </div>
  );
}
