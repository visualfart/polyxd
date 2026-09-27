import { useHalden } from "../session.ts";
import { Button, Card, Icon, TopBar, dayLabel, money, time } from "../ui.tsx";

export function Cards() {
  const { h, store, say, open } = useHalden();
  const c = h.card;
  const lastUsed = [...h.payments].reverse().find((p) => p.card);
  const toggle = () => {
    const undo = store.commit(c.frozen ? "Unfreeze card" : "Freeze card", (d) => {
      d.card.frozen = !c.frozen;
      d.card.frozenAt = c.frozen ? null : new Date().toISOString();
    });
    say(c.frozen ? "Card unfrozen." : "Card frozen. Nothing new goes through until you unfreeze it.", undo);
  };
  const setOnline = (on: boolean) => {
    store.commit("Online payments", (d) => {
      d.card.onlinePayments = on;
    });
  };
  return (
    <>
      <TopBar title="Card" back="/" />
      <div className={`hal-cardface${c.frozen ? " is-frozen" : ""}`} aria-label={`${c.network} card ending ${c.last4}${c.frozen ? ", frozen" : ""}`} role="img">
        <span className="hal-cardface-brand">halden</span>
        <span className="hal-cardface-number">···· ···· ···· {c.last4}</span>
        <span className="hal-cardface-row">
          <span>{h.person.name.toUpperCase()}</span>
          <span>{c.expiry}</span>
        </span>
        {c.frozen && (
          <span className="hal-cardface-frozen">
            <Icon name="snow" size={18} /> Frozen
          </span>
        )}
      </div>
      <div className="hal-actions" style={{ justifyContent: "center" }}>
        <Button tone={c.frozen ? "filled" : "tonal"} icon={c.frozen ? "check" : "snow"} onClick={toggle}>
          {c.frozen ? "Unfreeze" : "Freeze card"}
        </Button>
        <Button tone="outlined" onClick={() => open("card.freeze")}>
          Ask about the card
        </Button>
      </div>
      <Card tone="outlined">
        <dl className="hal-details">
          <dt>Status</dt>
          <dd>{c.frozen ? `Frozen ${dayLabel(c.frozenAt!).toLowerCase()} at ${time(c.frozenAt!)}` : "Active"}</dd>
          <dt>Contactless limit</dt>
          <dd>{money(c.contactlessLimit, { whole: true })}</dd>
          <dt>Last used</dt>
          <dd>{lastUsed ? `${dayLabel(lastUsed.at)}, ${money(-lastUsed.amount)}` : "Not yet"}</dd>
          <dt>Subscriptions on it</dt>
          <dd>{h.subscriptions.filter((s) => s.active).length}</dd>
        </dl>
      </Card>
      <Card tone="filled">
        <label className="hal-switch">
          <span>
            <span style={{ display: "block" }}>Online payments</span>
            <span className="hal-small hal-muted">Turn off to stop the card working on websites and in apps.</span>
          </span>
          <input type="checkbox" role="switch" checked={c.onlinePayments} onChange={(e) => setOnline(e.target.checked)} />
        </label>
      </Card>
      <p className="hal-small hal-muted">Freezing stops new card payments straight away. Subscriptions you've already set up keep going, so nothing you rely on stops without you.</p>
    </>
  );
}
