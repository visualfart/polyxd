import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useWexley } from "../session.ts";
import { Button, CodeBoxes, ErrorSummary, Field, Heading, Inset, TextField } from "../ui.tsx";

/**
 * The front door: an email address, then a 6-digit code "sent" to it. Nothing is sent and any six
 * digits work; the shape is GOV.UK's sign-in journey, one thing per page.
 */
export function SignIn() {
  const { w, store } = useWexley();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(w.session.email || w.resident.email);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([]);
  const step = w.session.codeSentAt ? "code" : "email";
  const from = (location.state as { from?: string } | null)?.from;
  if (w.session.signedIn) return <Navigate to={from && from !== "/signin" ? from : "/"} replace />;

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setErrors([{ id: "email", message: "Enter an email address in the correct format, like name@example.com" }]);
    setErrors([]);
    store.commit("Send code", (d) => {
      d.session.email = clean;
      d.session.codeSentAt = new Date().toISOString();
    });
  };
  const signIn = (e?: FormEvent, value = code) => {
    e?.preventDefault();
    if (value.replace(/\D/g, "").length !== 6) return setErrors([{ id: "code", message: "Enter the 6-digit code from the email" }]);
    setErrors([]);
    store.commit("Sign in", (d) => {
      d.session.signedIn = true;
      d.session.codeSentAt = null;
    });
    navigate(from && from !== "/signin" ? from : "/", { replace: true });
  };
  const startAgain = () => {
    setCode("");
    setErrors([]);
    store.commit("Change email", (d) => {
      d.session.codeSentAt = null;
    });
  };
  const err = (id: string) => errors.find((x) => x.id === id)?.message;

  return (
    <div className="wx-grid">
      <div>
        <ErrorSummary errors={errors} />
        {step === "email" ? (
          <form onSubmit={sendCode} noValidate>
            <Heading>Sign in to your account</Heading>
            <p className="wx-body">We send a 6-digit code to your email address. You do not need a password.</p>
            <TextField id="email" label="Email address" hint="The one you gave the council" type="email" autoComplete="email" inputMode="email" width="20" value={email} onChange={setEmail} error={err("email")} />
            <Button type="submit">Continue</Button>
            <Inset>
              <p className="wx-body">This is a demonstration. Nothing is sent, and any 6 digits work as the code.</p>
            </Inset>
          </form>
        ) : (
          <form onSubmit={signIn} noValidate>
            <Heading>Check your email</Heading>
            <p className="wx-body">
              We sent a code to <strong>{w.session.email}</strong>. It lasts 15 minutes.
            </p>
            <Field id="code" label="Enter the 6-digit code" hint="Typing the last digit signs you in" error={err("code")}>
              <CodeBoxes id="code" value={code} onChange={setCode} onComplete={(v) => signIn(undefined, v)} error={err("code")} />
            </Field>
            <Button type="submit">Sign in</Button>
            <p className="wx-body">
              <button type="button" className="wx-link" onClick={startAgain}>
                Use a different email address
              </button>
            </p>
            <Inset>
              <p className="wx-body">This is a demonstration. No email was sent: any 6 digits work.</p>
            </Inset>
          </form>
        )}
      </div>
    </div>
  );
}
