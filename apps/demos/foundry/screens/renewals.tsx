import { useState } from "react";
import { Link } from "react-router-dom";
import { daysUntil, member, plan, type Stage } from "../seed.ts";
import { useFoundry } from "../session.ts";
import { Avatar, Button, Card, Empty, Segmented, Stat, compact, daysWord, money, plural, shortDate } from "../ui.tsx";

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "upcoming", label: "Upcoming", hint: "Due in the next 120 days, not yet quoted" },
  { id: "quoted", label: "Quoted", hint: "A quote is with the customer" },
  { id: "won", label: "Won", hint: "Renewed this quarter" },
  { id: "churned", label: "Churned", hint: "Canceled or lapsed" },
];

export function Renewals() {
  const { h, store, say, open } = useFoundry();
  const [shown, setShown] = useState<Stage>("upcoming");
  const rows = h.renewals.map((r) => ({ r, a: h.accounts.find((a) => a.id === r.accountId)! })).filter((x) => x.a);
  const by = (s: Stage) => rows.filter((x) => x.r.stage === s).sort((x, y) => (s === "won" || s === "churned" ? y.r.movedAt.localeCompare(x.r.movedAt) : x.r.dueAt.localeCompare(y.r.dueAt)));
  const sum = (xs: { r: { amount: number } }[]) => xs.reduce((s, x) => s + x.r.amount, 0);
  const due90 = rows.filter((x) => (x.r.stage === "upcoming" || x.r.stage === "quoted") && daysUntil(x.r.dueAt) >= 0 && daysUntil(x.r.dueAt) <= 90);
  const won = (id: string) => {
    const x = rows.find((y) => y.r.id === id)!;
    const undo = store.commit(`Won ${x.a.name}`, (d) => {
      const r = d.renewals.find((y) => y.id === id)!;
      r.stage = "won";
      r.movedAt = new Date().toISOString();
      const acc = d.accounts.find((a) => a.id === r.accountId)!;
      const next = new Date(acc.renewalAt);
      next.setFullYear(next.getFullYear() + 1);
      acc.renewalAt = next.toISOString();
      acc.seats = r.seats;
      acc.plan = r.plan;
      acc.arr = r.amount;
      d.events.push({ id: `ev_${Date.now().toString(36)}`, accountId: acc.id, at: new Date().toISOString(), kind: "renewal", text: `Renewed for a year on ${plan(d, r.plan).name}: ${money(r.amount)}` });
    });
    say(`${x.a.name} renewed: ${money(x.r.amount)} a year. Next renewal ${shortDate(new Date(new Date(x.r.dueAt).setFullYear(new Date(x.r.dueAt).getFullYear() + 1)).toISOString())}.`, undo);
  };
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <h1 className="fd-page-title">Renewals</h1>
          <p className="fd-page-desc">The year ahead, by stage. Quotes go out from here; wins update the account.</p>
        </div>
        <div className="fd-page-actions">
          <Button icon="spark" onClick={() => open("accounts.renewing-with-tickets", { days: 60 })}>
            Renewing with tickets
          </Button>
        </div>
      </header>
      <div className="fd-stats">
        <Stat label="Due in 90 days" value={compact(sum(due90))} hint={`${plural(due90.length, "renewal")} · ${due90.filter((x) => x.r.stage === "quoted").length} quoted`} />
        <Stat label="Quoted" value={compact(sum(by("quoted")))} hint={plural(by("quoted").length, "quote", "quotes")} />
        <Stat label="Won this quarter" value={compact(sum(by("won")))} hint={plural(by("won").length, "renewal")} tone="success" />
        <Stat label="Churned" value={compact(sum(by("churned")))} hint={plural(by("churned").length, "account")} tone={by("churned").length ? "danger" : undefined} />
      </div>
      <Segmented label="Stage" options={STAGES.map((s) => ({ id: s.id, label: `${s.label} (${by(s.id).length})` }))} value={shown} onChange={setShown} />
      <div className="fd-pipeline">
        {STAGES.map((s) => {
          const items = by(s.id);
          return (
            <section key={s.id} className={`fd-column${shown === s.id ? " is-shown" : ""}`} aria-label={s.label}>
              <header className="fd-column-head">
                <span style={{ color: "inherit", fontWeight: 600, fontSize: 13 }}>
                  {s.label} <span>{items.length}</span>
                </span>
                <span>{compact(sum(items))}</span>
              </header>
              {items.length === 0 && <Empty icon="renewals" title={`Nothing ${s.label.toLowerCase()}`} body={s.hint} />}
              {items.map(({ r, a }) => {
                const days = daysUntil(r.dueAt);
                const p = plan(h, r.plan);
                return (
                  <article key={r.id} className="fd-rcard" aria-label={`${a.name} renewal`}>
                    <div className="fd-rcard-top">
                      <Link to={`/accounts/${a.id}`} className="fd-rcard-name">
                        {a.name}
                      </Link>
                      <span className="fd-rcard-amount">{money(r.amount)}</span>
                    </div>
                    <div className="fd-rcard-meta">
                      <span>
                        {p.name} · {plural(r.seats, "seat")}
                      </span>
                      <span className={s.id === "upcoming" && days <= 14 ? "fd-tone-warning" : undefined}>{s.id === "won" ? `Renewed ${shortDate(r.movedAt)}` : s.id === "churned" ? `Ended ${shortDate(r.movedAt)}` : `${shortDate(r.dueAt)} · ${daysWord(days)}`}</span>
                    </div>
                    <div className="fd-rcard-foot">
                      <span className="fd-row" style={{ gap: 6 }}>
                        <Avatar name={member(h, a.ownerId)?.name ?? "?"} size={18} />
                        <span className="fd-small fd-muted">{member(h, a.ownerId)?.name.split(" ")[0]}</span>
                      </span>
                      {s.id === "upcoming" && (
                        <Button size="sm" icon="spark" onClick={() => open("renewal.quote", { account: a.id })}>
                          Quote
                        </Button>
                      )}
                      {s.id === "quoted" && (
                        <span className="fd-row" style={{ gap: 4 }}>
                          <Button size="sm" variant="ghost" onClick={() => open("renewal.quote", { account: a.id, seats: r.seats, plan: r.plan })}>
                            Requote
                          </Button>
                          <Button size="sm" variant="default" onClick={() => won(r.id)}>
                            Mark won
                          </Button>
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <Card title="How a renewal moves">
        <p className="fd-small fd-muted" style={{ maxWidth: "70ch" }}>
          An account shows here 120 days before its renewal date. Quote it (the ask box does this: “quote Ledgerline's renewal at 120 seats”) and it moves to Quoted once the quote is sent. Mark it won when the customer accepts: the account's plan, seats and price update and the next renewal is a year out. A cancellation moves it to Churned.
        </p>
      </Card>
    </div>
  );
}
