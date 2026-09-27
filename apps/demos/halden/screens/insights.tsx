import { useState } from "react";
import { monthKey, monthName, spendByCategory, spent, thisMonth } from "../seed.ts";
import { useHalden } from "../session.ts";
import { Avatar, Button, Card, ListItem, SectionTitle, TopBar, money } from "../ui.tsx";

export function Insights() {
  const { h, open } = useHalden();
  const months = [...new Set(h.payments.map((p) => monthKey(p.at)))].sort();
  const [month, setMonth] = useState(thisMonth());
  const rows = spendByCategory(h, month);
  const total = spent(h, month);
  const max = Math.max(...months.map((m) => spent(h, m)), 1);
  const subs = h.subscriptions.filter((s) => s.active);
  const subsMonthly = subs.reduce((t, s) => t + (s.cadence === "monthly" ? s.amount : s.amount / 12), 0);
  return (
    <>
      <TopBar title="Insights" />
      <Card tone="filled">
        <div className="hal-stat">
          <span className="hal-stat-label">Spent in {monthName(month)}</span>
          <span className="hal-stat-value">{money(total)}</span>
        </div>
        <div className="hal-bars" role="group" aria-label="Spend by month" style={{ marginTop: 16 }}>
          {months.map((m) => (
            <button key={m} type="button" className={`hal-bar${m === month ? " is-current" : ""}`} onClick={() => setMonth(m)} aria-pressed={m === month} aria-label={`${monthName(m)}: ${money(spent(h, m))}`} style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}>
              <span style={{ height: `${Math.max(2, (spent(h, m) / max) * 120)}px` }} />
              <span>{monthName(m, "short")}</span>
            </button>
          ))}
        </div>
      </Card>
      <SectionTitle
        action={
          <Button tone="text" onClick={() => open("spend.compare")}>
            Compare months
          </Button>
        }
      >
        Where it went
      </SectionTitle>
      <ul className="hal-list">
        {rows.map((r) => (
          <li key={r.category}>
            <ListItem leading={<Avatar name={r.name} icon={h.categories.find((c) => c.id === r.category)?.icon} />} title={r.name} supporting={`${r.count} payment${r.count === 1 ? "" : "s"} · ${Math.round((r.total / total) * 100)}%`} trailing={<span>{money(r.total)}</span>} onClick={() => open("spend.category", { category: r.category })} />
          </li>
        ))}
      </ul>
      <SectionTitle
        action={
          <Button tone="text" onClick={() => open("subscriptions.list")}>
            Manage
          </Button>
        }
      >
        Every month
      </SectionTitle>
      <Card tone="outlined">
        <div className="hal-month">
          <div className="hal-stat">
            <span className="hal-stat-label">Subscriptions</span>
            <span className="hal-stat-value">{money(subsMonthly)}</span>
            <span className="hal-small hal-muted">{subs.length} active</span>
          </div>
          <div className="hal-stat">
            <span className="hal-stat-label">Rent and bills</span>
            <span className="hal-stat-value">{money(1150 + 78.4 + 31.2 + 164)}</span>
            <span className="hal-small hal-muted">4 payments</span>
          </div>
        </div>
      </Card>
    </>
  );
}
