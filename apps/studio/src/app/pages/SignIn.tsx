import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { useSession } from "../App.tsx";

export function SignIn() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const dev = me.signIn?.dev;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("POST", "/api/auth/dev", { email, name });
      await refresh();
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <div className="auth">
      <main>
        <div style={{ height: 72, padding: "0 48px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="brand"><span className="mark" aria-hidden="true">p</span><span className="name">Polyxd Studio</span></span>
        </div>
        <form className="form" onSubmit={submit}>
          <div>
            <h1>Sign in to Studio</h1>
            {dev && <p className="muted" style={{ marginTop: 6 }}>Local development: any email signs in. Production uses WorkOS for email, Google and SSO.</p>}
          </div>
          {me.signIn?.workos && (
            <a className="btn full" href="/api/auth/workos/start">Continue with your work account</a>
          )}
          {dev && (
            <>
              <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
              <div className="field"><label htmlFor="name">Name <span className="muted">(first time only)</span></label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
              {error && <p className="err" style={{ color: "var(--bad)" }}>{error}</p>}
              <button className="btn primary full" type="submit">Sign in</button>
            </>
          )}
          {!dev && !me.signIn?.workos && <p className="muted">No sign-in method is configured. Set DEV_AUTH=1 for local development, or WORKOS_CLIENT_ID and WORKOS_API_KEY.</p>}
        </form>
      </main>
      <aside>
        <span style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 700, color: "var(--signal)" }}>p</span>
        <p>Screens written on demand, in your design system, checked before anyone sees them.</p>
        <p>Studio is where your design system team decides what those screens may look like, and reviews what they actually look like.</p>
      </aside>
    </div>
  );
}
