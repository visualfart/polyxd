import { Link } from "react-router-dom";
import { suggestions } from "../../kit/ask.ts";
import { ASKABLE } from "../intents.ts";
import { covers, customer, daily, daysAgo, fullName, isLate, me, summarize, variantLabel } from "../seed.ts";
import { useQuay } from "../session.ts";
import { Badge, Banner, Bars, Button, Card, Icon, Stat, Thumb, compact, greeting, money, percent, plural, relative, shortDate } from "../ui.tsx";
import { PaymentBadge, FulfillmentBadge } from "./orders.tsx";

export function Home() {
  const { h, ask, open } = useQuay();
  const owner = me(h);
  const today = summarize(h, daysAgo(0), daysAgo(0));
  const yesterday = summarize(h, daysAgo(1), daysAgo(1));
  const week = summarize(h, daysAgo(6), daysAgo(0));
  const prevWeek = summarize(h, daysAgo(13), daysAgo(7));
  const lastWeek = summarize(h, daysAgo(7), daysAgo(1));
  const weekBefore = summarize(h, daysAgo(14), daysAgo(8));
  const toFulfill = h.orders.filter((o) => o.status === "open" && o.fulfillmentStatus !== "fulfilled");
  const late = h.orders.filter(isLate);
  const low = covers(h).filter((c) => c.product.status === "active" && c.days !== null && c.days <= 14);
  const carts = h.checkouts.filter((c) => c.emailStatus === "not_sent");
  const pending = h.orders.filter((o) => o.status === "open" && o.paymentStatus === "pending");
  const drafts = h.drafts.filter((d) => d.status === "open");
  const paused = h.campaigns.filter((c) => c.status === "paused");
  const recent = [...h.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const tries = suggestions(ASKABLE, 4, 0);
  const dipped = weekBefore.sales > 0 && (lastWeek.sales - weekBefore.sales) / weekBefore.sales <= -0.15;
  const days7 = daily(h, daysAgo(6), daysAgo(0));

  const next: { key: string; icon: string; tone: "danger" | "warning" | "info" | "success"; text: string; sub: string; action: React.ReactNode }[] = [];
  if (late.length) next.push({ key: "late", icon: "truck", tone: "danger", text: `${plural(late.length, "order")} past the promised ship date`, sub: `Oldest: #${late[0].number}, promised ${relative(late[0].promisedShipAt)}`, action: <Button size="slim" icon="spark" onClick={() => open("orders.late")}>Fulfill them</Button> });
  if (dipped) next.push({ key: "dip", icon: "trend", tone: "warning", text: `Sales last week were ${Math.round((1 - lastWeek.sales / weekBefore.sales) * 100)}% lower than the week before`, sub: `${money(lastWeek.sales)} against ${money(weekBefore.sales)}`, action: <Button size="slim" icon="spark" onClick={() => open("revenue.dip")}>Find out why</Button> });
  if (low.length) next.push({ key: "low", icon: "box", tone: "warning", text: `${plural(low.length, "variant")} sell out within two weeks`, sub: low.slice(0, 2).map((c) => `${variantLabel(c.product, c.variant)}: ${plural(c.days ?? 0, "day")}`).join(" · "), action: <Button size="slim" icon="spark" onClick={() => open("inventory.low", { days: 14 })}>See them</Button> });
  if (carts.length) next.push({ key: "carts", icon: "cart", tone: "info", text: `${plural(carts.length, "abandoned checkout")} haven't been reminded`, sub: `${money(carts.reduce((s, c) => s + c.subtotal, 0))} left in carts this week`, action: <Button size="slim" icon="spark" onClick={() => open("checkouts.recover")}>Send reminders</Button> });
  if (pending.length) next.push({ key: "pending", icon: "card", tone: "info", text: `${plural(pending.length, "order")} waiting on a bank deposit`, sub: pending.map((o) => `#${o.number}`).join(", "), action: <Button size="slim" to="/orders?view=unpaid">Review</Button> });
  if (drafts.length) next.push({ key: "drafts", icon: "note", tone: "info", text: `${plural(drafts.length, "draft order")} without an invoice`, sub: drafts.map((d) => `#D${d.number}`).join(", "), action: <Button size="slim" to="/orders/drafts">Open drafts</Button> });
  for (const c of paused) next.push({ key: `paused:${c.id}`, icon: "pause", tone: "warning", text: `${c.name} is paused`, sub: `${c.channel} · ${money(c.dailyBudget)} a day when running`, action: <Button size="slim" to="/marketing">Resume</Button> });

  return (
    <div className="q-page">
      <header className="q-page-head">
        <div className="q-page-text">
          <div className="q-page-titles">
            <h1 className="q-page-title">
              {greeting()}, {owner.name.split(" ")[0]}
            </h1>
            <p className="q-page-sub">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · Here's what's happening at {h.shop.name} today.</p>
          </div>
        </div>
      </header>

      <div className="q-stack">
        <button type="button" className="q-ask-hero" onClick={() => ask()} aria-label="Ask Quay">
          <Icon name="spark" size={18} />
          <span>Ask anything about your store: why sales dropped, what's about to sell out, refund an order…</span>
        </button>
        <div className="q-chips">
          {tries.map((t) => (
            <button key={t} type="button" className="q-chip" onClick={() => ask(t)}>
              <Icon name="spark" size={12} />
              {t}
            </button>
          ))}
        </div>
      </div>

      {late.length > 0 && (
        <Banner tone="warning" title={`${plural(late.length, "order")} should have shipped by now`} action={<Button size="slim" onClick={() => open("orders.late")}>Review and fulfill</Button>}>
          The store promises two business days. {late.map((o) => `#${o.number}`).join(", ")} {late.length === 1 ? "is" : "are"} past that.
        </Banner>
      )}

      <div className="q-stats">
        <Stat label="Total sales today" value={money(today.sales)} change={yesterday.sales ? (today.sales - yesterday.sales) / yesterday.sales : undefined} hint="vs yesterday" to="/analytics?range=today" />
        <Stat label="Orders today" value={today.orders} hint={`${plural(today.items, "item")}`} to="/orders?date=today" />
        <Stat label="To fulfill" value={toFulfill.length} hint={late.length ? `${late.length} late` : "all on time"} to="/orders?view=unfulfilled" />
        <Stat label="Sessions today" value={today.sessions} hint={`${percent(today.conversion, 1)} converted`} to="/analytics?range=today" />
      </div>

      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          <Card title="What's next" padded={false}>
            {next.length ? (
              <ul className="q-list" style={{ padding: "0 16px" }}>
                {next.map((it) => (
                  <li key={it.key} className="q-li">
                    <span className={`q-tl-icon q-tone-${it.tone === "info" ? "success" : it.tone}`}>
                      <Icon name={it.icon} size={13} />
                    </span>
                    <span className="q-li-text">
                      <span className="q-li-title">{it.text}</span>
                      <span className="q-li-sub">{it.sub}</span>
                    </span>
                    <span className="q-li-trailing">{it.action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="q-muted" style={{ padding: "8px 16px 16px" }}>
                Every order has shipped, nothing is running low and no cart is waiting. Enjoy it.
              </p>
            )}
          </Card>
          <Card title="Recent orders" actions={<Button variant="plain" to="/orders">View all</Button>} padded={false}>
            <ul className="q-list" style={{ padding: "0 16px" }}>
              {recent.map((o) => {
                const c = customer(h, o.customerId);
                return (
                  <li key={o.id} className="q-li">
                    <Thumb media={o.items[0]?.media} size={36} />
                    <span className="q-li-text">
                      <Link to={`/orders/${o.id}`} className="q-li-title">
                        #{o.number} · {c ? fullName(c) : "Guest"}
                      </Link>
                      <span className="q-li-sub">
                        {relative(o.createdAt)} · {plural(o.items.reduce((s, it) => s + it.qty, 0), "item")} · {money(o.total)}
                      </span>
                    </span>
                    <span className="q-li-trailing">
                      <PaymentBadge order={o} />
                      <FulfillmentBadge order={o} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
        <div className="q-stack q-stack-loose">
          <Card title="Sales this week" actions={<Button variant="plain" to="/analytics?range=7">Analytics</Button>}>
            <div className="q-stack">
              <span className="q-stat-value">{money(week.sales)}</span>
              <span className="q-stat-foot">
                <span className={`q-stat-change ${week.sales >= prevWeek.sales ? "is-up" : "is-down"}`}>{`${week.sales >= prevWeek.sales ? "+" : ""}${prevWeek.sales ? Math.round(((week.sales - prevWeek.sales) / prevWeek.sales) * 100) : 0}%`}</span>
                <span className="q-stat-hint">vs previous 7 days ({compact(prevWeek.sales)})</span>
              </span>
              <Bars values={days7.map((d) => d.revenue)} label={`Daily sales, ${shortDate(days7[0].date)} to today`} />
              <span className="q-small q-muted">
                {shortDate(days7[0].date)} – today · {plural(week.orders, "order")} · {money(week.aov)} average
              </span>
            </div>
          </Card>
          <Card title="Store" padded>
            <dl className="q-kv">
              <dt>Products</dt>
              <dd>
                {h.products.filter((p) => p.status === "active").length} active <span className="q-muted">of {h.products.length}</span>
              </dd>
              <dt>Customers</dt>
              <dd>{h.customers.length}</dd>
              <dt>Discounts</dt>
              <dd>
                {h.discounts.filter((d) => d.enabled).length} live · <Link to="/discounts" className="q-link">manage</Link>
              </dd>
              <dt>Campaigns</dt>
              <dd>
                {h.campaigns.map((c) => (
                  <span key={c.id} className="q-row" style={{ gap: 6, display: "inline-flex" }}>
                    {c.name} <Badge tone={c.status === "active" ? "success" : "warning"}>{c.status === "active" ? "Active" : "Paused"}</Badge>
                  </span>
                ))}
              </dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
