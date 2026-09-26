import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.ts";
import { useSession } from "../App.tsx";

type Mode = "signin" | "signup" | "forgot" | "reset";

/** better-auth's endpoints answer JSON; its errors carry a message a person can read. */
async function auth(path: string, body: unknown): Promise<any> {
  const r = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  const text = await r.text();
  const data = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(data.message ?? "Something went wrong");
  return data;
}

export function SignIn({ start = "signin" }: { start?: Mode }) {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(start);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const google = me.signIn?.google;
  const needsVerification = me.signIn?.emailVerification;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await auth("sign-up/email", { name, email, password, callbackURL: "/" });
        if (needsVerification) {
          setNotice(`Check ${email}: one click on the link and you're in. It works for an hour.`);
          setMode("signin");
        } else {
          await refresh();
          navigate("/");
        }
      } else if (mode === "signin") {
        await auth("sign-in/email", { email, password, rememberMe: true });
        await refresh();
        navigate("/");
      } else if (mode === "forgot") {
        await auth("request-password-reset", { email, redirectTo: "/reset-password" });
        setNotice(`If there's an account for ${email}, a link is on its way. It works for an hour.`);
      } else if (mode === "reset") {
        await auth("reset-password", { newPassword: password, token: params.get("token") });
        setNotice("Password changed. Sign in with it.");
        setMode("signin");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const withGoogle = async () => {
    const r = await auth("sign-in/social", { provider: "google", callbackURL: "/" });
    if (r.url) location.href = r.url;
  };
  const title = { signin: "Sign in to Studio", signup: "Create your account", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const sub = { signin: null, signup: "Free for one workspace. No card needed.", forgot: "Enter your email and we'll send a link to choose a new one.", reset: "At least 12 characters." }[mode];
  return (
    <div className="auth">
      <main>
        <div style={{ height: 72, padding: "0 48px", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="brand"><span className="mark" aria-hidden="true">p</span><span className="name">Polyxd Studio</span></span>
        </div>
        <form className="form" onSubmit={submit}>
          <div>
            <h1>{title}</h1>
            {sub && <p className="muted" style={{ marginTop: 6 }}>{sub}</p>}
            {!needsVerification && mode !== "reset" && <p className="muted small" style={{ marginTop: 6 }}>Local development: no email goes out, so an account works as soon as it's created.</p>}
          </div>
          {notice && <div className="notice ok" role="status"><div className="body">{notice}</div></div>}
          {error && <div className="notice bad" role="alert"><div className="body">{error}</div></div>}
          {google && (mode === "signin" || mode === "signup") && (
            <>
              <button type="button" className="btn full" onClick={withGoogle}>Continue with Google</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--muted)", fontSize: 12 }}><span style={{ flexGrow: 1, height: 1, background: "var(--line)" }} />or<span style={{ flexGrow: 1, height: 1, background: "var(--line)" }} /></div>
            </>
          )}
          {mode !== "reset" && (
            <div className="field"><label htmlFor="email">{mode === "signup" ? "Work email" : "Email"}</label><input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></div>
          )}
          {mode === "signup" && (
            <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          {mode !== "forgot" && (
            <div className="field">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>
                {mode === "signin" && <button type="button" className="btn ghost sm" style={{ height: "auto", padding: 0 }} onClick={() => setMode("forgot")}>Forgot password?</button>}
              </div>
              <div style={{ height: 44, boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center" }}>
                <input id="password" type={show ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signin" ? undefined : 12} value={password} onChange={(e) => setPassword(e.target.value)} required style={{ flexGrow: 1, height: "100%", border: 0, background: "transparent", padding: "0 10px", font: "inherit" }} />
                <button type="button" style={{ border: 0, background: "transparent", font: "inherit", fontSize: 13, color: "var(--muted)", padding: "0 12px" }} onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
              </div>
              {mode !== "signin" && <span className="help">At least 12 characters. A sentence you'll remember beats symbols you won't.</span>}
            </div>
          )}
          <button className="btn primary full" type="submit" disabled={busy}>{{ signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Save and sign in" }[mode]}</button>
          {mode === "signup" && <p className="small muted">By creating an account you agree to the <a href="https://polyxd.com/terms">Terms</a> and <a href="https://polyxd.com/privacy">Privacy policy</a>.</p>}
          <p className="muted" style={{ fontSize: 14 }}>
            {mode === "signin" && <>New to Studio? <button type="button" className="btn ghost sm" style={{ height: "auto", padding: 0, color: "var(--signal-ink)" }} onClick={() => setMode("signup")}>Create an account</button></>}
            {mode === "signup" && <>Already have an account? <button type="button" className="btn ghost sm" style={{ height: "auto", padding: 0, color: "var(--signal-ink)" }} onClick={() => setMode("signin")}>Sign in</button></>}
            {(mode === "forgot" || mode === "reset") && <button type="button" className="btn ghost sm" style={{ height: "auto", padding: 0, color: "var(--signal-ink)" }} onClick={() => setMode("signin")}>Back to sign in</button>}
          </p>
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
