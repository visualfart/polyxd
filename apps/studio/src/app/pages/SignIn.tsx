import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../App.tsx";
import { Mark } from "../mark.tsx";
import "../signin.css";

type Mode = "signin" | "signup" | "forgot" | "reset";

/** better-auth's endpoints answer JSON; its errors carry a message a person can read. */
async function auth(path: string, body: unknown): Promise<any> {
  const r = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  const text = await r.text();
  const data = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(data.message ?? "Something went wrong");
  return data;
}

/** `?mode=signup` or `?mode=forgot` opens that form; anything else is the sign-in. */
function startMode(start: Mode, param: string | null): Mode {
  if (start === "reset") return "reset";
  return param === "signup" || param === "forgot" ? param : start;
}

export function SignIn({ start = "signin" }: { start?: Mode }) {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => startMode(start, params.get("mode")));
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const google = me.signIn?.google;
  const needsVerification = me.signIn?.emailVerification;

  const switchTo = (m: Mode) => {
    setMode(m);
    setError("");
    setNotice("");
  };
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
  const title = { signin: "Sign in to Studio", signup: "Create your workspace", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const sub = { signin: null, signup: "Free for one workspace. No card needed.", forgot: "Enter your email and we'll send a link to choose a new one.", reset: "At least 12 characters." }[mode];
  const cta = { signin: "Sign in", signup: "Create account", forgot: "Send reset link", reset: "Save and sign in" }[mode];
  return (
    <div className="signin">
      <main className="signin-main">
        <div className="signin-top">
          <Link className="signin-brand" to="/welcome" aria-label="Polyxd Studio">
            <Mark size={28} />
            <span className="signin-wordmark">Polyxd</span>
            <span className="signin-product">Studio</span>
          </Link>
          <Link className="signin-back" to="/welcome">
            <span aria-hidden="true">← </span>Back to studio.polyxd.com
          </Link>
        </div>
        <form className="signin-form" onSubmit={submit}>
          <div className="signin-head">
            <h1>{title}</h1>
            {sub && <p className="signin-sub">{sub}</p>}
            {!needsVerification && mode !== "reset" && <p className="signin-local">Local development: no email goes out, so an account works as soon as it's created.</p>}
          </div>
          <div aria-live="polite">
            {notice && <div className="notice ok" role="status"><div className="body">{notice}</div></div>}
          </div>
          <div aria-live="assertive">
            {error && <div className="notice bad" role="alert"><div className="body">{error}</div></div>}
          </div>
          {google && (mode === "signin" || mode === "signup") && (
            <>
              <button type="button" className="btn full" onClick={withGoogle}>Continue with Google</button>
              <div className="signin-or" aria-hidden="true"><span />or<span /></div>
            </>
          )}
          {mode !== "reset" && (
            <div className="field">
              <label htmlFor="email">{mode === "signup" ? "Work email" : "Email"}</label>
              <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
          )}
          {mode === "signup" && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          {mode !== "forgot" && (
            <div className="field">
              <div className="signin-label-row">
                <label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>
                {mode === "signin" && <button type="button" className="signin-link" onClick={() => switchTo("forgot")}>Forgot password?</button>}
              </div>
              <div className="signin-password">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={mode === "signin" ? undefined : 12}
                  aria-describedby={mode === "signin" ? undefined : "password-help"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus={mode === "reset"}
                />
                <button type="button" className="signin-show" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls="password">{show ? "Hide" : "Show"}</button>
              </div>
              {mode !== "signin" && <span className="help" id="password-help">At least 12 characters. A sentence you'll remember beats symbols you won't.</span>}
            </div>
          )}
          <button className="btn primary full" type="submit" disabled={busy}>{busy ? "One moment…" : cta}</button>
          {mode === "signup" && <p className="signin-terms">By creating an account you agree to the <a href="https://polyxd.com/terms">Terms</a> and <a href="https://polyxd.com/privacy">Privacy policy</a>.</p>}
          <p className="signin-switch">
            {mode === "signin" && <>New to Studio? <button type="button" className="signin-link" onClick={() => switchTo("signup")}>Create a workspace</button></>}
            {mode === "signup" && <>Already have an account? <button type="button" className="signin-link" onClick={() => switchTo("signin")}>Sign in</button></>}
            {(mode === "forgot" || mode === "reset") && <button type="button" className="signin-link" onClick={() => switchTo("signin")}>Back to sign in</button>}
          </p>
        </form>
      </main>
      <aside className="signin-panel" aria-label="About Polyxd">
        <div className="signin-panel-inner">
          <Mark size={104} state="looking" ink="var(--ink)" title="The Polyxd mark, looking toward the form" />
          <p className="signin-claim">Screens written on demand, in your design system, checked before anyone sees them.</p>
          <p className="signin-products"><span>Spec</span><span>Renderer</span><span>Verifier</span></p>
        </div>
      </aside>
    </div>
  );
}
