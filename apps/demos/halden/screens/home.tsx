import { Link } from "react-router-dom";
import { balance, income, lastMonth, monthName, spent, spentToDay, thisMonth } from "../seed.ts";
import { useHalden } from "../session.ts";
import { Avatar, Button, Card, Icon, SectionTitle, greeting, money } from "../ui.tsx";
import { PaymentItem } from "./payments.tsx";

export function Home() {
  const { h, ask, open } = useHalden();
  const month = thisMonth();
  const out = spent(h, month);
  const inn = income(h, month);
  const prev = spentToDay(h, lastMonth(), new Date().getDate());
  const recent = [...h.payments].reverse().slice(0, 6);
  const budgets = h.budgets.map((b) => ({ ...b, spent: spent(h, month, b.category), name: h.categories.find((c) => c.id === b.category)?.name ?? b.category }));
  return (
    <>
      <header className="hal-top hal-top-large">
        <div className="hal-top-row">
          <span className="hal-top-title hal-muted hal-small">{greeting()}</span>
          <div className="hal-top-trailing">
            <Link className="hal-icon-button" to="/settings" aria-label="Settings">
              <Avatar name={h.person.name} size={32} />
            </Link>
          </div>
        </div>
        <h1 className="hal-top-headline">{h.person.firstName}</h1>
      </header>

      <Card tone="filled" className="hal-balance">
        <span className="hal-balance-label">{h.account.name}</span>
        <span className="hal-balance-value">{money(balance(h))}</span>
        <div className="hal-balance-row">
          <span>{monthName(month)}: {money(out)} out, {money(inn)} in</span>
          <span>{h.card.frozen ? "Card frozen" : `Card ··${h.card.last4}`}</span>
        </div>
        <div className="hal-balance-actions">
          <Button tone="tonal" icon="send" onClick={() => open("money.send")}>
            Send
          </Button>
          <Button tone="tonal" icon="card" to="/cards">
            Card
          </Button>
        </div>
      </Card>

      <button type="button" className="hal-ask" onClick={() => ask()}>
        <Icon name="spark" className="hal-ask-spark" />
        <span className="hal-ask-text">Ask Halden anything</span>
      </button>

      <Card tone="outlined">
        <div className="hal-month">
          <div className="hal-stat">
            <span className="hal-stat-label">Spent in {monthName(month)}</span>
            <span className="hal-stat-value">{money(out)}</span>
          </div>
          <div className="hal-stat">
            <span className="hal-stat-label">By this day in {monthName(lastMonth())}</span>
            <span className="hal-stat-value">{money(prev)}</span>
          </div>
        </div>
        {budgets.length > 0 && (
          <div className="hal-stack" style={{ marginTop: 16 }}>
            {budgets.map((b) => (
              <div key={b.category} className="hal-stack" style={{ gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }} className="hal-small">
                  <span>{b.name}</span>
                  <span className="hal-muted">
                    {money(b.spent)} of {money(b.limit, { whole: true })}
                  </span>
                </div>
                <div className={`hal-budget-bar${b.spent > b.limit ? " is-over" : ""}`} role="progressbar" aria-label={`${b.name} budget`} aria-valuenow={Math.min(100, Math.round((b.spent / b.limit) * 100))} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${Math.min(100, (b.spent / b.limit) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <Button tone="text" to="/budgets">
            All budgets
          </Button>
        </div>
      </Card>

      <SectionTitle
        action={
          <Button tone="text" to="/payments">
            See all
          </Button>
        }
      >
        Recent
      </SectionTitle>
      <ul className="hal-list">
        {recent.map((p) => (
          <PaymentItem key={p.id} p={p} />
        ))}
      </ul>
    </>
  );
}
