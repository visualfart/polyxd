import { useHalden } from "../session.ts";
import { Avatar, Button, Card, SectionTitle, TopBar, longDate } from "../ui.tsx";

export function Settings() {
  const { h, store, say } = useHalden();
  const set = (fn: (d: typeof h) => void) => store.commit("Settings", fn);
  const n = h.settings.notifications;
  return (
    <>
      <TopBar title="Settings" back="/" />
      <div className="hal-hero">
        <Avatar name={h.person.name} size={72} />
        <span className="hal-hero-title">{h.person.name}</span>
        <p>
          {h.person.email} · {h.person.city} · with Halden since {longDate(h.person.memberSince)}
        </p>
      </div>
      <SectionTitle>Appearance</SectionTitle>
      <div className="hal-segmented" role="group" aria-label="Appearance">
        {(["system", "light", "dark"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={h.settings.appearance === v} onClick={() => set((d) => void (d.settings.appearance = v))}>
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <SectionTitle>Tell me about</SectionTitle>
      <Card tone="outlined">
        {(
          [
            ["payments", "Every payment", "A notification the moment money moves."],
            ["budgets", "Budgets", "When a budget is 80% used, and when it's over."],
            ["security", "Security", "New sign-ins, card changes, and anything unusual."],
          ] as const
        ).map(([key, title, body]) => (
          <label key={key} className="hal-switch">
            <span>
              <span style={{ display: "block" }}>{title}</span>
              <span className="hal-small hal-muted">{body}</span>
            </span>
            <input type="checkbox" role="switch" checked={n[key]} onChange={(e) => set((d) => void (d.settings.notifications[key] = e.target.checked))} />
          </label>
        ))}
      </Card>
      <SectionTitle>Account</SectionTitle>
      <Card tone="outlined">
        <dl className="hal-details">
          <dt>Sort code</dt>
          <dd>{h.account.sortCode}</dd>
          <dt>Account number</dt>
          <dd>{h.account.accountNumber}</dd>
        </dl>
      </Card>
      <SectionTitle>This demo</SectionTitle>
      <p className="hal-small hal-muted">
        Halden is a demonstration of <a href="https://polyxd.com" style={{ textDecoration: "underline" }}>Polyxd</a>: the screens you ask for are generated as data, rendered in Material 3 through Polyxd's semantic tokens, and verified before they show. Everything you do here stays in this browser.
      </p>
      <div className="hal-actions">
        <Button
          tone="outlined"
          onClick={() => {
            store.reset();
            say("Back to the start: three months of Maya's payments, as they were.");
          }}
        >
          Reset the demo
        </Button>
        <Button tone="text" onClick={() => set((d) => void (d.settings.onboarded = false))}>
          See the welcome again
        </Button>
      </div>
    </>
  );
}
