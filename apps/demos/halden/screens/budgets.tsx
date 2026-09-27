import { lastMonth, monthName, spent, thisMonth } from "../seed.ts";
import { useHalden } from "../session.ts";
import { Avatar, Button, Card, Empty, ListItem, SectionTitle, TopBar, money } from "../ui.tsx";

export function Budgets() {
  const { h, open } = useHalden();
  const month = thisMonth();
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const rows = h.budgets.map((b) => {
    const c = h.categories.find((x) => x.id === b.category)!;
    const used = spent(h, month, b.category);
    return { ...b, name: c.name, icon: c.icon, used, left: b.limit - used, pct: Math.min(100, (used / b.limit) * 100) };
  });
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const totalUsed = rows.reduce((s, r) => s + r.used, 0);
  const without = h.categories.filter((c) => !["income", "transfers", "rent"].includes(c.id) && !h.budgets.some((b) => b.category === c.id) && spent(h, lastMonth(), c.id) > 0);
  return (
    <>
      <TopBar
        title="Budgets"
        trailing={
          <Button tone="text" icon="add" onClick={() => open("budget.set")}>
            New
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Empty icon="wallet" title="No budgets yet" body="A budget is a monthly amount for a category. Halden shows how you're doing against it." action={<Button tone="filled" onClick={() => open("budget.set")}>Set a budget</Button>} />
      ) : (
        <>
          <Card tone="filled">
            <div className="hal-month">
              <div className="hal-stat">
                <span className="hal-stat-label">Budgeted in {monthName(month)}</span>
                <span className="hal-stat-value">{money(totalUsed)}</span>
                <span className="hal-small hal-muted">of {money(totalLimit, { whole: true })}</span>
              </div>
              <div className="hal-stat">
                <span className="hal-stat-label">Days left</span>
                <span className="hal-stat-value">{daysLeft}</span>
                <span className="hal-small hal-muted">{money(Math.max(0, totalLimit - totalUsed))} to go</span>
              </div>
            </div>
          </Card>
          <ul className="hal-list">
            {rows.map((r) => (
              <li key={r.category} className="hal-stack" style={{ padding: "8px 0" }}>
                <ListItem leading={<Avatar name={r.name} icon={r.icon} />} title={r.name} supporting={r.left >= 0 ? `${money(r.left)} left` : `${money(-r.left)} over`} trailing={<span>{money(r.used)} / {money(r.limit, { whole: true })}</span>} onClick={() => open("budget.set", { category: r.category })} />
                <div className={`hal-budget-bar${r.used > r.limit ? " is-over" : ""}`} role="progressbar" aria-label={`${r.name} budget`} aria-valuenow={Math.round(r.pct)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${r.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {without.length > 0 && (
        <>
          <SectionTitle>Without a budget</SectionTitle>
          <ul className="hal-list">
            {without.map((c) => (
              <li key={c.id}>
                <ListItem leading={<Avatar name={c.name} icon={c.icon} />} title={c.name} supporting={`${money(spent(h, lastMonth(), c.id))} in ${monthName(lastMonth())}`} trailing={<span className="hal-small">Set one</span>} onClick={() => open("budget.set", { category: c.id })} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
