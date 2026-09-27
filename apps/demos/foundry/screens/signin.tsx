import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useFoundry } from "../session.ts";
import { Button, Field } from "../ui.tsx";

/** The front door. Any email and password work: nothing here is real and nothing leaves the browser. */
export function SignIn() {
  const { store } = useFoundry();
  const navigate = useNavigate();
  const [email, setEmail] = useState("noor@basalt.io");
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    store.commit("Sign in", (d) => {
      d.session.signedIn = true;
      d.session.user.email = email.trim() || "noor@basalt.io";
    });
    navigate("/", { replace: true });
  };
  return (
    <main className="fd-signin">
      <div className="fd-signin-card">
        <div className="fd-brand" style={{ padding: 0 }}>
          <span className="fd-mark" aria-hidden="true">
            f
          </span>
          <span className="fd-brand-text">
            <span className="fd-brand-name">Foundry</span>
            <span className="fd-brand-ws">Basalt · Customer success</span>
          </span>
        </div>
        <h1>Sign in to the desk</h1>
        <form className="fd-signin-form" onSubmit={submit}>
          <Field label="Work email" htmlFor="email">
            <input id="email" className="fd-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" className="fd-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Anything at all" />
          </Field>
          <Button type="submit" variant="default">
            Sign in
          </Button>
        </form>
        <p className="fd-signin-note">
          This is a demonstration of <a href="https://polyxd.com">Polyxd</a>. Any email and password work; you sign in as Noor Haddad, who leads the desk. The customers, tickets and people are invented, and everything you do stays in this browser.
        </p>
      </div>
    </main>
  );
}
