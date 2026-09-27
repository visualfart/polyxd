import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PLANS, daysUntil, health, isOpen, member, openTickets, plan, type Account as Acc, type Event } from "../seed.ts";
import { useFoundry } from "../session.ts";
import { Avatar, Badge, Button, Card, DataTable, Empty, Field, Icon, Meter, Person, Select, SearchBox, Stat, Tabs, dateOnly, daysWord, longDate, money, percent, plural, relative, shortDate, time, type Column } from "../ui.tsx";
import { PRIORITY, STATUS } from "../views.ts";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "renewing", label: "Renewing soon" },
  { id: "risk", label: "At risk" },
  { id: "mine", label: "Mine" },
  { id: "canceled", label: "Canceled" },
];
const HEALTH_TONE = { Healthy: "success", Watch: "warning", "At risk": "danger" } as const;

export function Accounts() {
  const { h, open } = useFoundry();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "all";
  const days = Number(params.get("days") ?? 60);
  const q = params.get("q") ?? "";
  const planF = params.get("plan") ?? "";
  const healthF = params.get("health") ?? "";
  const ownerF = params.get("owner") ?? "";
  const set = (k: string, v: string) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return h.accounts
      .map((a) => ({ a, hs: health(h, a), open: openTickets(h, a.id).length, owner: member(h, a.ownerId)?.name ?? "" }))
      .filter(({ a, hs }) => {
        if (view === "canceled") return a.status === "canceled";
        if (a.status !== "active") return false;
        if (view === "renewing") return hs.daysToRenewal >= 0 && hs.daysToRenewal <= days;
        if (view === "risk") return hs.label === "At risk";
        if (view === "mine") return a.ownerId === h.session.user.id;
        return true;
      })
      .filter(({ a }) => !planF || a.plan === planF)
      .filter(({ hs }) => !healthF || hs.label === healthF)
      .filter(({ a }) => !ownerF || a.ownerId === ownerF)
      .filter(({ a, owner }) => !needle || [a.name, a.industry, a.domain, owner].some((s) => s.toLowerCase().includes(needle)));
  }, [h, view, days, q, planF, healthF, ownerF]);
  type Row = (typeof rows)[number];

  const counts = {
    all: h.accounts.filter((a) => a.status === "active").length,
    renewing: h.accounts.filter((a) => a.status === "active" && daysUntil(a.renewalAt) >= 0 && daysUntil(a.renewalAt) <= days).length,
    risk: h.accounts.filter((a) => a.status === "active" && health(h, a).label === "At risk").length,
    mine: h.accounts.filter((a) => a.status === "active" && a.ownerId === h.session.user.id).length,
    canceled: h.accounts.filter((a) => a.status === "canceled").length,
  };
  const columns: Column<Row>[] = [
    { key: "name", label: "Account", sort: (r) => r.a.name, render: (r) => (
        <span className="fd-row" style={{ gap: 10, flexWrap: "nowrap" }}>
          <Avatar name={r.a.name} size={24} square />
          <span>
            {r.a.name}
            <span className="fd-cell-sub">{r.a.industry}</span>
          </span>
        </span>
      ) },
    { key: "plan", label: "Plan", sort: (r) => PLANS.findIndex((p) => p.id === r.a.plan), render: (r) => <Badge tone="outline">{plan(h, r.a.plan).name}</Badge> },
    { key: "seats", label: "Seats", align: "end", sort: (r) => r.a.seats, render: (r) => (
        <span className="fd-row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <Meter value={r.a.seatsUsed} max={r.a.seats} label={`${r.a.name} seats in use`} tone={r.hs.usage < 0.45 ? "danger" : r.hs.usage < 0.7 ? "warning" : undefined} />
          <span className="fd-tabular">
            {r.a.seatsUsed}/{r.a.seats}
          </span>
        </span>
      ), secondary: true },
    { key: "arr", label: "ARR", align: "end", sort: (r) => r.a.arr, render: (r) => <span className="fd-tabular">{money(r.a.arr)}</span> },
    { key: "health", label: "Health", sort: (r) => r.hs.score, render: (r) => r.a.status === "canceled" ? <Badge tone="neutral">Canceled</Badge> : (
        <span className="fd-row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <Badge tone={HEALTH_TONE[r.hs.label]} dot>
            {r.hs.label}
          </Badge>
          <span className="fd-small fd-muted fd-tabular">{r.hs.score}</span>
        </span>
      ) },
    { key: "renews", label: "Renews", sort: (r) => r.a.renewalAt, render: (r) => (
        <span>
          {shortDate(r.a.renewalAt)}
          <span className="fd-cell-sub">{r.a.status === "canceled" ? "Access ends" : daysWord(r.hs.daysToRenewal)}</span>
        </span>
      ) },
    { key: "owner", label: "Owner", sort: (r) => r.owner, render: (r) => <Person name={r.owner} size={20} />, secondary: true },
    { key: "tickets", label: "Open tickets", align: "end", sort: (r) => r.open, render: (r) => <span className="fd-tabular">{r.open || <span className="fd-muted">–</span>}</span> },
  ];
  const owners = h.team.filter((m) => h.accounts.some((a) => a.ownerId === m.id));
  const filtered = Boolean(q || planF || healthF || ownerF);
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <h1 className="fd-page-title">Accounts</h1>
          <p className="fd-page-desc">
            {plural(counts.all, "customer")} on annual plans · {money(h.accounts.filter((a) => a.status === "active").reduce((s, a) => s + a.arr, 0))} ARR
          </p>
        </div>
        <div className="fd-page-actions">
          <Button icon="spark" onClick={() => open("accounts.renewing-with-tickets", { days: 30 })}>
            Renewing with tickets
          </Button>
        </div>
      </header>
      <Tabs label="Saved views" items={VIEWS.map((v) => ({ ...v, count: counts[v.id as keyof typeof counts] }))} value={view} onChange={(v) => set("view", v === "all" ? "" : v)} />
      <div className="fd-toolbar">
        <SearchBox value={q} onChange={(v) => set("q", v)} placeholder="Search name, industry, owner" label="Search accounts" />
        {view === "renewing" && <Select size="sm" label="Window" value={String(days)} onChange={(v) => set("days", v)} options={[30, 60, 90, 120].map((d) => ({ value: String(d), label: `Next ${d} days` }))} />}
        <Select size="sm" label="Plan" value={planF} onChange={(v) => set("plan", v)} options={[{ value: "", label: "Any plan" }, ...PLANS.map((p) => ({ value: p.id, label: p.name }))]} />
        <Select size="sm" label="Health" value={healthF} onChange={(v) => set("health", v)} options={[{ value: "", label: "Any health" }, { value: "Healthy", label: "Healthy" }, { value: "Watch", label: "Watch" }, { value: "At risk", label: "At risk" }]} />
        <Select size="sm" label="Owner" value={ownerF} onChange={(v) => set("owner", v)} options={[{ value: "", label: "Any owner" }, ...owners.map((m) => ({ value: m.id, label: m.name }))]} />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setParams((p) => (["q", "plan", "health", "owner"].forEach((k) => p.delete(k)), p))}>
            Clear
          </Button>
        )}
        <span className="fd-spacer" />
        <span className="fd-small fd-muted">{plural(rows.length, "account")}</span>
      </div>
      <Card padded={false}>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.a.id} href={(r) => `/accounts/${r.a.id}`} caption="Accounts" defaultSort={view === "renewing" ? { key: "renews", dir: "asc" } : { key: "arr", dir: "desc" }} empty={<Empty icon="accounts" title="No accounts match" body={filtered ? "Fewer words, or clear a filter." : view === "risk" ? "Nothing is at risk right now. Health is computed from seats in use, open tickets and how close the renewal is." : "Nothing in this view."} action={filtered ? <Button size="sm" onClick={() => setParams((p) => (["q", "plan", "health", "owner"].forEach((k) => p.delete(k)), p))}>Clear filters</Button> : undefined} />} />
      </Card>
    </div>
  );
}

/* ---- One account ---- */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tickets", label: "Tickets" },
  { id: "contacts", label: "Contacts" },
  { id: "timeline", label: "Timeline" },
  { id: "notes", label: "Notes" },
];

export function Account() {
  const { id, tab = "overview" } = useParams();
  const { h, open } = useFoundry();
  const navigate = useNavigate();
  const a = h.accounts.find((x) => x.id === id);
  if (!a) return <Empty icon="accounts" title="That account isn't here" body="It may have been removed when the demo was reset." action={<Button to="/accounts">All accounts</Button>} />;
  const hs = health(h, a);
  const p = plan(h, a.plan);
  const tickets = h.tickets.filter((t) => t.accountId === a.id).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const contacts = h.contacts.filter((c) => c.accountId === a.id);
  const notes = h.notes.filter((n) => n.accountId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const events = h.events.filter((e) => e.accountId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const canceled = a.status === "canceled";
  const counts: Record<string, number | undefined> = { tickets: tickets.filter(isOpen).length || undefined, contacts: contacts.length, notes: notes.length || undefined };
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <Link className="fd-back" to="/accounts">
            <Icon name="back" size={14} />
            Accounts
          </Link>
          <h1 className="fd-page-title">
            <Avatar name={a.name} size={28} square />
            {a.name}
            <Badge tone="outline">{p.name}</Badge>
            {canceled ? (
              <Badge tone="neutral">Canceled</Badge>
            ) : (
              <Badge tone={HEALTH_TONE[hs.label]} dot>
                {hs.label} · {hs.score}
              </Badge>
            )}
          </h1>
          <p className="fd-page-desc">
            {a.industry} · {a.domain} · {a.region} · customer since {shortDate(a.startedAt)}
          </p>
        </div>
        <div className="fd-page-actions">
          <Button icon="spark" onClick={() => open("account.health", { account: a.id })}>
            {hs.label === "Healthy" ? "Explain health" : "Why at risk"}
          </Button>
          {!canceled && (
            <>
              <Button icon="spark" onClick={() => open("renewal.quote", { account: a.id })}>
                Quote renewal
              </Button>
              <Button icon="spark" onClick={() => open("plans.compare", { account: a.id })}>
                Compare plans
              </Button>
              <Button variant="ghost" onClick={() => open("subscription.cancel", { account: a.id })}>
                Cancel plan
              </Button>
            </>
          )}
        </div>
      </header>

      {canceled && (
        <div className="fd-card" style={{ padding: "10px 16px" }}>
          <span className="fd-row">
            <Icon name="ban" size={14} />
            Plan canceled on {dateOnly(a.canceledAt!)}. Access ends {dateOnly(a.renewalAt)}; data is erased 90 days later.
          </span>
        </div>
      )}

      <div className="fd-stats">
        <Stat label="ARR" value={money(a.arr)} hint={`${plural(a.seats, "seat")} × ${money(p.perSeat)}`} />
        <Stat label="Seats in use" value={percent(hs.usage)} hint={`${a.seatsUsed} of ${a.seats} · ${hs.trend >= 0 ? "+" : ""}${Math.round(hs.trend * 100)}% in 4 weeks`} tone={hs.usage < 0.45 ? "danger" : hs.usage < 0.7 ? "warning" : undefined} />
        <Stat label="Open tickets" value={hs.open} hint={hs.urgent ? `${plural(hs.urgent, "urgent")}${hs.breached ? `, ${hs.breached} past target` : ""}` : hs.open ? "None urgent" : "Nothing open"} to={`/accounts/${a.id}/tickets`} tone={hs.urgent ? "danger" : undefined} />
        <Stat label={canceled ? "Access ends" : "Renews"} value={shortDate(a.renewalAt)} hint={daysWord(hs.daysToRenewal)} tone={!canceled && hs.daysToRenewal <= 30 ? "warning" : undefined} />
        <Stat label="Owner" value={<Person name={member(h, a.ownerId)?.name ?? "Unassigned"} size={22} />} hint={member(h, a.ownerId)?.title} />
      </div>

      <Tabs label="Account sections" items={TABS.map((t) => ({ ...t, count: counts[t.id] }))} value={tab} onChange={(t) => navigate(`/accounts/${a.id}${t === "overview" ? "" : `/${t}`}`)} />

      {tab === "overview" && <OverviewTab a={a} hs={hs} events={events.slice(0, 6)} contacts={contacts} />}
      {tab === "tickets" && (
        <Card padded={false}>
          <TicketsTable tickets={tickets} accountName={a.name} />
        </Card>
      )}
      {tab === "contacts" && (
        <Card padded={false}>
          <DataTable
            rows={contacts}
            rowKey={(c) => c.id}
            caption={`Contacts at ${a.name}`}
            columns={[
              { key: "name", label: "Name", sort: (c) => c.name, render: (c) => <Person name={c.name} size={24} /> },
              { key: "role", label: "Role", sort: (c) => c.role, render: (c) => c.role },
              { key: "email", label: "Email", render: (c) => <a href={`mailto:${c.email}`} className="fd-mono">{c.email}</a> },
              { key: "primary", label: "", render: (c) => (c.primary ? <Badge tone="outline">Primary</Badge> : null), secondary: true },
            ]}
            empty={<Empty icon="user" title="No contacts yet" body="Contacts are added when someone at the customer writes in or signs the order." />}
          />
        </Card>
      )}
      {tab === "timeline" && (
        <Card title="Timeline" description="Everything that happened on this account, newest first">
          <Timeline events={events} />
        </Card>
      )}
      {tab === "notes" && <NotesTab a={a} notes={notes} />}
    </div>
  );
}

function OverviewTab({ a, hs, events, contacts }: { a: Acc; hs: ReturnType<typeof health>; events: Event[]; contacts: { name: string; email: string; role: string; primary: boolean }[] }) {
  const { h } = useFoundry();
  const p = plan(h, a.plan);
  const max = Math.max(...a.weeklyActive, 1);
  const primary = contacts.find((c) => c.primary) ?? contacts[0];
  return (
    <div className="fd-grid fd-grid-main">
      <div className="fd-stack" style={{ gap: 16 }}>
        <Card title="Health" description={`Score ${hs.score} of 100, from seats in use, the support load and the renewal date`}>
          <div className="fd-grid fd-grid-2">
            <div className="fd-stack">
              <span className="fd-small fd-muted">Weekly active seats, 12 weeks</span>
              <div className="fd-bars" role="img" aria-label={`Weekly active seats from ${a.weeklyActive[0]} to ${a.weeklyActive[11]}`}>
                {a.weeklyActive.map((n, i) => (
                  <span key={i} style={{ height: `${Math.max(4, (n / max) * 100)}%` }} title={`${n} active`} />
                ))}
              </div>
              <span className="fd-small fd-muted">
                {a.weeklyActive[0]} → {a.weeklyActive[11]} of {a.seats} seats
              </span>
            </div>
            <div className="fd-stack">
              <span className="fd-small fd-muted">{hs.positive ? "What's keeping the score up" : hs.label === "Healthy" ? "Worth watching, even so" : "What's pulling the score down"}</span>
              <ul className="fd-stack" style={{ gap: 4 }}>
                {hs.reasons.map((r) => (
                  <li key={r} className="fd-row" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}>
                    <Icon name={hs.positive ? "check" : "alert"} size={13} className={hs.positive ? "fd-tone-success" : "fd-tone-warning"} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        <Card title="Recent activity" actions={<Button variant="ghost" size="sm" to={`/accounts/${a.id}/timeline`}>Full timeline</Button>}>
          <Timeline events={events} />
        </Card>
      </div>
      <div className="fd-stack" style={{ gap: 16 }}>
        <Card title="Plan">
          <dl className="fd-kv">
            <dt>Plan</dt>
            <dd>{p.name}, annual</dd>
            <dt>Seats</dt>
            <dd>
              {a.seats} at {money(p.perSeat)} each
            </dd>
            <dt>ARR</dt>
            <dd className="fd-tabular">{money(a.arr)}</dd>
            <dt>First response</dt>
            <dd>{p.sla}</dd>
            <dt>Support</dt>
            <dd>{p.support}</dd>
            <dt>Started</dt>
            <dd>{dateOnly(a.startedAt)}</dd>
            <dt>{a.status === "canceled" ? "Access ends" : "Renews"}</dt>
            <dd>{dateOnly(a.renewalAt)}</dd>
            <dt>Region</dt>
            <dd>{a.region}</dd>
          </dl>
        </Card>
        {primary && (
          <Card title="Primary contact" actions={<Button variant="ghost" size="sm" to={`/accounts/${a.id}/contacts`}>All {contacts.length}</Button>}>
            <Person name={primary.name} detail={`${primary.role} · ${primary.email}`} size={32} />
          </Card>
        )}
      </div>
    </div>
  );
}

const EVENT_ICON: Record<Event["kind"], string> = { started: "play", seats: "seats", plan: "tag", renewal: "renewals", ticket: "tickets", note: "note", call: "phone", contact: "user", quote: "dollar", canceled: "ban" };

export function Timeline({ events }: { events: Event[] }) {
  if (!events.length) return <Empty icon="clock" title="Nothing yet" body="Renewals, plan changes, tickets and notes land here as they happen." />;
  return (
    <ol className="fd-timeline">
      {events.map((e) => (
        <li key={e.id} className="fd-tl-item">
          <span className="fd-tl-icon">
            <Icon name={EVENT_ICON[e.kind]} size={12} />
          </span>
          <span className="fd-tl-text">{e.ref ? <Link to={`/tickets/${e.ref}`}>{e.text}</Link> : e.text}</span>
          <span className="fd-tl-when" title={longDate(e.at)}>
            {shortDate(e.at)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function NotesTab({ a, notes }: { a: Acc; notes: { id: string; authorId: string; at: string; body: string }[] }) {
  const { h, store, say } = useFoundry();
  const [body, setBody] = useState("");
  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const undo = store.commit("Add note", (d) => {
      d.notes.push({ id: `note_${Date.now().toString(36)}`, accountId: a.id, authorId: d.session.user.id, at: new Date().toISOString(), body: text });
      d.events.push({ id: `ev_${Date.now().toString(36)}`, accountId: a.id, at: new Date().toISOString(), kind: "note", text: `Note: ${text.length > 60 ? `${text.slice(0, 57)}…` : text}` });
    });
    setBody("");
    say(`Note added to ${a.name}.`, undo);
  };
  return (
    <div className="fd-grid fd-grid-main">
      <Card title="Notes" description="What the desk knows that the data doesn't">
        {notes.length ? (
          <ul className="fd-list">
            {notes.map((n) => (
              <li key={n.id} className="fd-li" style={{ alignItems: "flex-start" }}>
                <Avatar name={member(h, n.authorId)?.name ?? "?"} size={24} />
                <span className="fd-li-text">
                  <span className="fd-small fd-muted">
                    {member(h, n.authorId)?.name ?? "Someone"} · {shortDate(n.at)} at {time(n.at)}
                  </span>
                  <span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="note" title="No notes yet" body={`Write the first one: who the champion is, what they said on the last call, what to do before renewal.`} />
        )}
      </Card>
      <Card title="Add a note">
        <form className="fd-stack" onSubmit={add}>
          <Field label="Note" htmlFor="note">
            <textarea id="note" className="fd-textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Something worth knowing about ${a.name}`} />
          </Field>
          <div className="fd-row">
            <Button type="submit" variant="default" disabled={!body.trim()}>
              Add note
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const PRIORITY_TONE = { urgent: "danger", high: "warning", normal: "neutral", low: "outline" } as const;
const STATUS_TONE = { open: "info", pending: "warning", solved: "success", closed: "neutral" } as const;

/** The ticket table an account shows; the queue has its own columns. */
export function TicketsTable({ tickets, accountName }: { tickets: ReturnType<typeof useFoundry>["h"]["tickets"]; accountName: string }) {
  const { h } = useFoundry();
  return (
    <DataTable
      rows={tickets}
      rowKey={(t) => t.id}
      href={(t) => `/tickets/${t.id}`}
      caption={`Tickets from ${accountName}`}
      defaultSort={{ key: "updated", dir: "desc" }}
      columns={[
        { key: "number", label: "#", sort: (t) => t.number, render: (t) => <span className="fd-mono">#{t.number}</span>, width: "72px", secondary: true },
        { key: "subject", label: "Subject", sort: (t) => t.subject, render: (t) => t.subject },
        { key: "priority", label: "Priority", sort: (t) => ["urgent", "high", "normal", "low"].indexOf(t.priority), render: (t) => <Badge tone={PRIORITY_TONE[t.priority]} dot>{PRIORITY[t.priority]}</Badge> },
        { key: "status", label: "Status", sort: (t) => t.status, render: (t) => <Badge tone={STATUS_TONE[t.status]}>{STATUS[t.status]}</Badge> },
        { key: "assignee", label: "Assignee", sort: (t) => member(h, t.assigneeId)?.name ?? "", render: (t) => (t.assigneeId ? <Person name={member(h, t.assigneeId)!.name} size={20} /> : <span className="fd-muted">Unassigned</span>), secondary: true },
        { key: "updated", label: "Updated", sort: (t) => t.updatedAt, render: (t) => <span title={longDate(t.updatedAt)}>{relative(t.updatedAt)}</span> },
      ]}
      empty={<Empty icon="tickets" title="No tickets" body={`When someone at ${accountName} writes in, it shows here.`} />}
    />
  );
}
