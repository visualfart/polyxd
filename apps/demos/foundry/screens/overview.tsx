import { Link } from "react-router-dom";
import { breached, daysUntil, health, isOpen, me, member, type Account, type Priority } from "../seed.ts";
import { useFoundry } from "../session.ts";
import { Badge, Button, Card, Icon, Meter, Person, Stat, compact, daysWord, greeting, money, plural, relative, shortDate } from "../ui.tsx";

const PRIORITY_TONE: Record<Priority, "danger" | "warning" | "neutral" | "outline"> = { urgent: "danger", high: "warning", normal: "neutral", low: "outline" };

export function Overview() {
  const { h, open } = useFoundry();
  const user = me(h);
  const active = h.accounts.filter((a) => a.status === "active");
  const scored = active.map((a) => ({ a, hs: health(h, a) }));
  const inWindow = (days: number) => active.filter((a) => daysUntil(a.renewalAt) >= 0 && daysUntil(a.renewalAt) <= days);
  const open_ = h.tickets.filter(isOpen);
  const byPriority = (["urgent", "high", "normal", "low"] as Priority[]).map((p) => ({ p, n: open_.filter((t) => t.priority === p).length }));
  const byHealth = (["Healthy", "Watch", "At risk"] as const).map((label) => ({ label, n: scored.filter((x) => x.hs.label === label).length }));
  const pipeline = (stage: string) => h.renewals.filter((r) => r.stage === stage);
  const sum = (xs: { amount: number }[]) => xs.reduce((s, r) => s + r.amount, 0);
  const load = h.team.filter((m) => m.role !== "viewer" && m.status !== "invited").map((m) => ({ m, n: h.tickets.filter((t) => t.assigneeId === m.id && isOpen(t)).length }));

  // What a lead looks at first: the things that will cost money or trust if nobody moves today.
  const attention: { key: string; icon: string; tone: "danger" | "warning" | "info"; text: string; sub: string; action: React.ReactNode }[] = [];
  for (const { a, hs } of scored.filter((x) => x.hs.label === "At risk" && x.hs.daysToRenewal <= 60).sort((x, y) => x.hs.daysToRenewal - y.hs.daysToRenewal)) {
    attention.push({ key: `risk:${a.id}`, icon: "alert", tone: "danger", text: `${a.name} is at risk and renews ${daysWord(hs.daysToRenewal)}`, sub: `${money(a.arr)} a year · ${hs.reasons[0]}`, action: <Button size="sm" onClick={() => open("account.health", { account: a.id })}>Why at risk</Button> });
  }
  for (const t of h.tickets.filter(breached).sort((x, y) => x.slaDueAt.localeCompare(y.slaDueAt)).slice(0, 4)) {
    attention.push({ key: `sla:${t.id}`, icon: "clock", tone: "danger", text: `#${t.number} is past its first-response target`, sub: `${h.accounts.find((a) => a.id === t.accountId)?.name} · ${t.priority} · due ${relative(t.slaDueAt)}`, action: <Button size="sm" to={`/tickets/${t.id}`}>Open ticket</Button> });
  }
  const away = h.team.filter((m) => m.status === "away").map((m) => ({ m, n: h.tickets.filter((t) => t.assigneeId === m.id && isOpen(t)).length })).filter((x) => x.n > 0);
  for (const { m, n } of away) attention.push({ key: `away:${m.id}`, icon: "team", tone: "warning", text: `${m.name} is away with ${plural(n, "open ticket")}`, sub: m.awayUntil ? `Back ${shortDate(m.awayUntil)}` : "", action: <Button size="sm" onClick={() => open("tickets.reassign", { from: m.id })}>Hand over</Button> });
  for (const r of pipeline("upcoming").filter((r) => daysUntil(r.dueAt) >= 0 && daysUntil(r.dueAt) <= 21).sort((x, y) => x.dueAt.localeCompare(y.dueAt))) {
    const a = h.accounts.find((x) => x.id === r.accountId)!;
    attention.push({ key: `quote:${r.id}`, icon: "renewals", tone: "warning", text: `${a.name} renews ${daysWord(daysUntil(r.dueAt))} and hasn't been quoted`, sub: `${money(r.amount)} a year on ${r.plan[0].toUpperCase()}${r.plan.slice(1)}`, action: <Button size="sm" onClick={() => open("renewal.quote", { account: a.id })}>Quote</Button> });
  }
  const unassigned = open_.filter((t) => !t.assigneeId && Date.now() - new Date(t.createdAt).getTime() > 86400000);
  if (unassigned.length) attention.push({ key: "unassigned", icon: "tickets", tone: "info", text: `${plural(unassigned.length, "ticket")} unassigned for more than a day`, sub: unassigned.slice(0, 3).map((t) => `#${t.number}`).join(", "), action: <Button size="sm" to="/tickets?view=unassigned">Assign</Button> });

  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <div className="fd-eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="fd-page-title">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
          <p className="fd-page-desc">
            {plural(active.length, "customer")} · {money(active.reduce((s, a) => s + a.arr, 0))} ARR · {plural(open_.length, "open ticket")}
          </p>
        </div>
        <div className="fd-page-actions">
          <Button icon="spark" onClick={() => open("accounts.renewing-with-tickets", { days: 30 })}>
            Renewing with tickets
          </Button>
        </div>
      </header>

      <div className="fd-stats">
        {[30, 60, 90].map((d) => {
          const xs = inWindow(d);
          return <Stat key={d} label={`Renewing in ${d} days`} value={xs.length} hint={`${compact(xs.reduce((s, a) => s + a.arr, 0))} ARR`} to={`/accounts?view=renewing&days=${d}`} />;
        })}
        <Stat label="Open tickets" value={open_.length} hint={`${byPriority[0].n} urgent · ${byPriority[1].n} high`} to="/tickets?view=all" tone={byPriority[0].n ? "danger" : undefined} />
        <Stat label="At risk" value={byHealth[2].n} hint={`${byHealth[1].n} to watch · ${byHealth[0].n} healthy`} to="/accounts?view=risk" tone={byHealth[2].n ? "danger" : undefined} />
      </div>

      <div className="fd-grid fd-grid-main">
        <div className="fd-stack" style={{ gap: 16 }}>
          <Card title="Needs attention" description={attention.length ? `${attention.length} things that move money or trust today` : "Nothing is waiting on you"} padded={false}>
            {attention.length ? (
              <ul className="fd-list" style={{ padding: "0 16px" }}>
                {attention.slice(0, 8).map((it) => (
                  <li key={it.key} className="fd-li">
                    <span className={`fd-tl-icon fd-tone-${it.tone}`}>
                      <Icon name={it.icon} size={13} />
                    </span>
                    <span className="fd-li-text">
                      <span className="fd-li-title">{it.text}</span>
                      {it.sub && <span className="fd-li-sub">{it.sub}</span>}
                    </span>
                    <span className="fd-li-trailing">{it.action}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fd-muted" style={{ padding: "8px 16px 16px" }}>
                Every at-risk renewal has a plan and every ticket has an owner.
              </p>
            )}
            {attention.length > 8 && (
              <p className="fd-small fd-muted" style={{ padding: "8px 16px 12px" }}>
                And {attention.length - 8} more. <Link to="/accounts?view=risk">See all at risk</Link>
              </p>
            )}
          </Card>

          <div className="fd-grid fd-grid-2">
            <Card title="Open tickets by priority" actions={<Button variant="ghost" size="sm" to="/tickets?view=all">All tickets</Button>}>
              <div className="fd-stack">
                {byPriority.map(({ p, n }) => (
                  <Link key={p} to={`/tickets?view=all&priority=${p}`} className="fd-row" style={{ justifyContent: "space-between" }}>
                    <Badge tone={PRIORITY_TONE[p]} dot>
                      {p[0].toUpperCase() + p.slice(1)}
                    </Badge>
                    <span className="fd-row" style={{ gap: 12 }}>
                      <Meter value={n} max={Math.max(1, open_.length)} label={`${p} tickets`} />
                      <span className="fd-tabular" style={{ width: 24, textAlign: "right" }}>
                        {n}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
            <Card title="Accounts by health" actions={<Button variant="ghost" size="sm" to="/accounts">All accounts</Button>}>
              <div className="fd-stack">
                {byHealth.map(({ label, n }) => (
                  <Link key={label} to={`/accounts?health=${encodeURIComponent(label)}`} className="fd-row" style={{ justifyContent: "space-between" }}>
                    <Badge tone={label === "Healthy" ? "success" : label === "Watch" ? "warning" : "danger"} dot>
                      {label}
                    </Badge>
                    <span className="fd-row" style={{ gap: 12 }}>
                      <Meter value={n} max={Math.max(1, active.length)} label={`${label} accounts`} tone={label === "Healthy" ? "success" : label === "Watch" ? "warning" : "danger"} />
                      <span className="fd-tabular" style={{ width: 24, textAlign: "right" }}>
                        {n}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="fd-stack" style={{ gap: 16 }}>
          <Card title="Renewals" actions={<Button variant="ghost" size="sm" to="/renewals">Pipeline</Button>}>
            <dl className="fd-kv">
              {(["upcoming", "quoted", "won", "churned"] as const).map((s) => (
                <PipelineRow key={s} label={s[0].toUpperCase() + s.slice(1)} n={pipeline(s).length} amount={sum(pipeline(s))} />
              ))}
            </dl>
          </Card>
          <Card title="Team load" description="Open tickets against capacity" actions={<Button variant="ghost" size="sm" to="/team">Team</Button>}>
            <div className="fd-stack" style={{ gap: 10 }}>
              {load.map(({ m, n }) => (
                <div key={m.id} className="fd-row" style={{ justifyContent: "space-between" }}>
                  <Person name={m.name} detail={m.status === "away" ? "Away" : undefined} size={22} />
                  <span className="fd-row" style={{ gap: 10 }}>
                    <Meter value={n} max={m.capacity || 1} label={`${m.name}'s load`} tone={n > m.capacity ? "danger" : n > m.capacity * 0.8 ? "warning" : undefined} />
                    <span className="fd-tabular fd-small" style={{ width: 40, textAlign: "right" }}>
                      {n}/{m.capacity}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PipelineRow({ label, n, amount }: { label: string; n: number; amount: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="fd-row" style={{ justifyContent: "space-between" }}>
        <span>{n}</span>
        <span className="fd-tabular">{compact(amount)}</span>
      </dd>
    </>
  );
}

export const healthTone = (a: Account, label: string) => (a.status === "canceled" ? "neutral" : label === "Healthy" ? "success" : label === "Watch" ? "warning" : "danger") as "neutral" | "success" | "warning" | "danger";
export const ownerName = (h: ReturnType<typeof useFoundry>["h"], id: string) => member(h, id)?.name ?? "Unassigned";
