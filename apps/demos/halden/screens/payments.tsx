import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { category, dayKey, merchant, payee, type Payment as Pay } from "../seed.ts";
import { useHalden } from "../session.ts";
import { Amount, Avatar, Button, Card, Chip, Empty, Icon, ListItem, TopBar, dayLabel, longDate, money, time } from "../ui.tsx";

const STATUS: Record<Pay["status"], { label: string; tone: string } | null> = {
  settled: null,
  pending: { label: "Pending", tone: "info" },
  "refund-pending": { label: "Refund pending", tone: "warning" },
  refunded: { label: "Refunded", tone: "success" },
};

export function PaymentItem({ p }: { p: Pay }) {
  const { h } = useHalden();
  const m = merchant(h, p.merchantId);
  const py = payee(h, p.payeeId);
  const cat = category(h, p.category);
  const name = m?.name ?? py?.name ?? p.description;
  const status = STATUS[p.status];
  return (
    <li>
      <ListItem
        to={`/payments/${p.id}`}
        leading={<Avatar name={name} icon={m ? cat.icon : undefined} />}
        title={name}
        supporting={status ? `${status.label} · ${cat.name}` : `${time(p.at)} · ${cat.name}`}
        trailing={<Amount value={p.amount} className={p.status === "refunded" ? "hal-muted" : undefined} />}
      />
    </li>
  );
}

export function Payments() {
  const { h } = useHalden();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...h.payments]
      .reverse()
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !needle || [merchant(h, p.merchantId)?.name, payee(h, p.payeeId)?.name, p.description, p.reference].some((s) => s?.toLowerCase().includes(needle)));
  }, [h, q, cat]);
  const days = useMemo(() => {
    const groups: { key: string; label: string; items: Pay[]; total: number }[] = [];
    for (const p of list) {
      const key = dayKey(p.at);
      let g = groups.at(-1);
      if (!g || g.key !== key) groups.push((g = { key, label: dayLabel(p.at), items: [], total: 0 }));
      g.items.push(p);
      if (p.amount < 0) g.total += p.amount;
    }
    return groups;
  }, [list]);
  const cats = h.categories.filter((c) => h.payments.some((p) => p.category === c.id));
  return (
    <>
      <TopBar title="Payments" />
      <label className="hal-search">
        <Icon name="search" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payments" aria-label="Search payments" />
        {q && (
          <button type="button" className="hal-icon-button" onClick={() => setQ("")} aria-label="Clear search">
            <Icon name="close" size={20} />
          </button>
        )}
      </label>
      <div className="hal-chips" role="group" aria-label="Filter by category">
        <Chip selected={cat === null} onClick={() => setCat(null)}>
          All
        </Chip>
        {cats.map((c) => (
          <Chip key={c.id} selected={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)} icon={c.icon}>
            {c.name}
          </Chip>
        ))}
      </div>
      {days.length === 0 ? (
        <Empty icon="search" title="No payments match" body="Try fewer words, or clear the category." action={<Button tone="text" onClick={() => (setQ(""), setCat(null))}>Clear</Button>} />
      ) : (
        days.map((d) => (
          <section key={d.key} aria-label={d.label}>
            <h2 className="hal-day">
              {d.label}
              {d.total < 0 && <span style={{ float: "right" }}>{money(d.total)}</span>}
            </h2>
            <ul className="hal-list">
              {d.items.map((p) => (
                <PaymentItem key={p.id} p={p} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

export function Payment() {
  const { id } = useParams();
  const { h, open } = useHalden();
  const p = h.payments.find((x) => x.id === id);
  if (!p) return <Empty icon="payments" title="That payment isn't here" action={<Button to="/payments">All payments</Button>} />;
  const m = merchant(h, p.merchantId);
  const py = payee(h, p.payeeId);
  const cat = category(h, p.category);
  const name = m?.name ?? py?.name ?? p.description;
  const status = STATUS[p.status];
  const dispute = p.disputeId ? h.disputes.find((d) => d.id === p.disputeId) : undefined;
  const sub = m ? h.subscriptions.find((s) => s.merchantId === m.id) : undefined;
  const twin = m && h.payments.find((x) => x.id !== p.id && x.merchantId === m.id && x.amount === p.amount && Math.abs(new Date(x.at).getTime() - new Date(p.at).getTime()) < 3600000);
  return (
    <>
      <TopBar title="Payment" back="/payments" hidden />
      <div className="hal-hero">
        <Avatar name={name} size={64} icon={m ? cat.icon : undefined} />
        <span className="hal-hero-amount">{money(p.amount, { sign: p.amount > 0 })}</span>
        <span className="hal-hero-title">{name}</span>
        <p>
          {longDate(p.at)} at {time(p.at)}
        </p>
        {status && <span className={`hal-status hal-status-${status.tone}`}>{status.label}</span>}
      </div>
      {twin && p.status === "settled" && (
        <Card tone="filled">
          <div className="hal-stack">
            <b style={{ fontWeight: 500 }}>Charged twice?</b>
            <span className="hal-small hal-muted">
              {name} took {money(-p.amount)} again at {time(twin.at)}. If you only bought one thing, report it and Halden asks for the money back.
            </span>
            <div className="hal-actions">
              <Button tone="filled" onClick={() => open("payment.dispute", { merchant: m?.id, payment: p.id })}>
                Report it
              </Button>
            </div>
          </div>
        </Card>
      )}
      {dispute && (
        <Card tone="filled">
          <div className="hal-stack">
            <b style={{ fontWeight: 500 }}>Reported {dayLabel(dispute.raisedAt).toLowerCase()}</b>
            <span className="hal-small hal-muted">
              {name} has until {longDate(dispute.decideBy)} to answer. If they don't, the {money(-p.amount)} comes back to you.
            </span>
          </div>
        </Card>
      )}
      <Card tone="outlined">
        <dl className="hal-details">
          <dt>Category</dt>
          <dd>{cat.name}</dd>
          {m && (
            <>
              <dt>Where</dt>
              <dd>{m.where}</dd>
            </>
          )}
          {p.reference && (
            <>
              <dt>Reference</dt>
              <dd>{p.reference}</dd>
            </>
          )}
          <dt>Paid with</dt>
          <dd>{p.card ? `${h.card.network} ··${h.card.last4}` : "Bank payment"}</dd>
          {sub && (
            <>
              <dt>Recurring</dt>
              <dd>{money(sub.amount)} every {sub.cadence === "monthly" ? "month" : "year"}</dd>
            </>
          )}
        </dl>
      </Card>
      <div className="hal-actions">
        {py && (
          <Button tone="tonal" icon="send" onClick={() => open("money.send", { payee: py.id })}>
            Send again
          </Button>
        )}
        {py && (
          <Button tone="outlined" to={`/payees/${py.id}`}>
            View payee
          </Button>
        )}
        {m && p.status === "settled" && !twin && (
          <Button tone="outlined" onClick={() => open("payment.dispute", { merchant: m.id, payment: p.id })}>
            Something wrong?
          </Button>
        )}
        {sub && (
          <Button tone="outlined" onClick={() => open("subscriptions.list")}>
            Manage subscriptions
          </Button>
        )}
      </div>
    </>
  );
}
