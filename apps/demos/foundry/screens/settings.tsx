import { useState } from "react";
import { me } from "../seed.ts";
import { useFoundry } from "../session.ts";
import { Button, Card, Field, Kbd, Segmented, plural } from "../ui.tsx";
import { MOD } from "../app.tsx";

export function Settings() {
  const { h, store, say } = useFoundry();
  const user = me(h);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(h.session.user.email);
  const saveProfile = () => {
    const n = name.trim();
    if (!n) return;
    store.commit("Profile", (d) => {
      const m = d.team.find((x) => x.id === d.session.user.id);
      if (m) m.name = n;
      d.session.user.email = email.trim() || d.session.user.email;
    });
    say("Profile saved.");
  };
  return (
    <div className="fd-page" style={{ maxWidth: 760 }}>
      <header className="fd-page-head">
        <div className="fd-page-text">
          <h1 className="fd-page-title">Settings</h1>
          <p className="fd-page-desc">Who you are on the desk, how Foundry looks, and the demo's reset switch.</p>
        </div>
      </header>
      <Card title="Profile" description="Shown on tickets you reply to and notes you write">
        <form
          className="fd-stack"
          style={{ gap: 12, maxWidth: 420 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile();
          }}
        >
          <Field label="Name" htmlFor="name">
            <input id="name" className="fd-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
          <Field label="Email" htmlFor="email" hint={`${user.title} · ${user.role}`}>
            <input id="email" className="fd-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <div className="fd-row">
            <Button type="submit" variant="default" disabled={name.trim() === user.name && email.trim() === h.session.user.email}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>
      <Card title="Appearance" description="Follows the system unless you pick one">
        <Segmented label="Appearance" value={h.settings.appearance} onChange={(v) => store.commit("Appearance", (d) => void (d.settings.appearance = v))} options={[{ id: "system", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} />
      </Card>
      <Card title="Keyboard">
        <dl className="fd-kv">
          <dt>
            <Kbd>{MOD}</Kbd> <Kbd>K</Kbd>
          </dt>
          <dd>Ask Foundry, or jump to a screen or account</dd>
          <dt>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>↵</Kbd>
          </dt>
          <dd>Move through the palette and open</dd>
          <dt>
            <Kbd>esc</Kbd>
          </dt>
          <dd>Close a sheet, the palette or the navigation</dd>
        </dl>
      </Card>
      <Card title="This demo" description="Foundry is a demonstration of Polyxd">
        <div className="fd-stack" style={{ gap: 12 }}>
          <p className="fd-small fd-muted" style={{ maxWidth: "70ch" }}>
            The screens you ask for are generated as Polyxd documents, rendered in shadcn/ui through Polyxd's semantic tokens, and verified in thirteen design systems before they show. Basalt, its {plural(h.accounts.length, "customer")} and the people on this desk are invented. Everything you do here stays in this browser; Reset puts the seed back and signs you out.
          </p>
          <div className="fd-row">
            <Button
              variant="outline"
              onClick={() => {
                store.reset();
                say("Back to the start: the desk as it was this morning.");
              }}
            >
              Reset the demo
            </Button>
            <Button variant="ghost" icon="logout" onClick={() => store.commit("Sign out", (d) => void (d.session.signedIn = false))}>
              Sign out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
