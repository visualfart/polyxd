import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { breached, health, isOpen, me, member, plan, type Priority, type Ticket as Tk, type TicketStatus } from "../seed.ts";
import { useFoundry } from "../session.ts";
import { Avatar, Badge, Button, Card, Chip, DataTable, Empty, Field, Icon, Person, Select, SearchBox, Tabs, dateOnly, longDate, plural, relative, shortDate, time, type Column } from "../ui.tsx";
import { PRIORITY, STATUS } from "../views.ts";

const PRIORITY_TONE = { urgent: "danger", high: "warning", normal: "neutral", low: "outline" } as const;
const STATUS_TONE = { open: "info", pending: "warning", solved: "success", closed: "neutral" } as const;
const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];

function Sla({ t }: { t: Tk }) {
  if (t.firstResponseAt) return <span className="fd-muted">Answered {relative(t.firstResponseAt)}</span>;
  if (!isOpen(t)) return <span className="fd-muted">–</span>;
  if (breached(t)) return <span className="fd-tone-danger">Past target · {relative(t.slaDueAt)}</span>;
  return <span className={new Date(t.slaDueAt).getTime() - Date.now() < 3600000 ? "fd-tone-warning" : undefined}>Due {relative(t.slaDueAt)}</span>;
}

export function Tickets() {
  const { h, open } = useFoundry();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "mine";
  const priority = params.get("priority") ?? "";
  const status = params.get("status") ?? "active";
  const q = params.get("q") ?? "";
  const accountF = params.get("account") ?? "";
  const set = (k: string, v: string) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });
  const meId = h.session.user.id;
  const base = h.tickets.filter((t) => (status === "active" ? isOpen(t) : status === "all" ? true : t.status === status));
  const inView = (t: Tk) => (view === "mine" ? t.assigneeId === meId : view === "unassigned" ? !t.assigneeId : true);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return base
      .filter(inView)
      .filter((t) => !priority || t.priority === priority)
      .filter((t) => !accountF || t.accountId === accountF)
      .filter((t) => !needle || [t.subject, `#${t.number}`, h.accounts.find((a) => a.id === t.accountId)?.name ?? ""].some((s) => s.toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h, view, priority, status, q, accountF]);
  const counts = { mine: base.filter((t) => t.assigneeId === meId).length, unassigned: base.filter((t) => !t.assigneeId).length, all: base.length };
  const account = accountF ? h.accounts.find((a) => a.id === accountF) : undefined;
  const columns: Column<Tk>[] = [
    { key: "subject", label: "Ticket", sort: (t) => t.subject, render: (t) => (
        <span>
          <span className="fd-mono fd-muted" style={{ marginRight: 8 }}>
            #{t.number}
          </span>
          {t.subject}
          <span className="fd-cell-sub">{h.accounts.find((a) => a.id === t.accountId)?.name}</span>
        </span>
      ) },
    { key: "priority", label: "Priority", sort: (t) => PRIORITIES.indexOf(t.priority), render: (t) => <Badge tone={PRIORITY_TONE[t.priority]} dot>{PRIORITY[t.priority]}</Badge> },
    { key: "status", label: "Status", sort: (t) => t.status, render: (t) => <Badge tone={STATUS_TONE[t.status]}>{STATUS[t.status]}</Badge> },
    { key: "assignee", label: "Assignee", sort: (t) => member(h, t.assigneeId)?.name ?? "", render: (t) => (t.assigneeId ? <Person name={member(h, t.assigneeId)!.name} size={20} /> : <span className="fd-muted">Unassigned</span>) },
    { key: "sla", label: "First response", sort: (t) => (t.firstResponseAt ? "z" : t.slaDueAt), render: (t) => <Sla t={t} />, secondary: true },
    { key: "updated", label: "Updated", sort: (t) => t.updatedAt, render: (t) => <span title={longDate(t.updatedAt)}>{relative(t.updatedAt)}</span> },
  ];
  const emptyBody = view === "mine" ? (status === "active" ? "Nothing is assigned to you. Take one from the unassigned queue, or enjoy it." : "No tickets of yours with that status.") : view === "unassigned" ? "Everything has an owner." : "Try another status, or clear the search.";
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <h1 className="fd-page-title">Tickets</h1>
          <p className="fd-page-desc">
            {h.tickets.filter((t) => t.status === "open").length} open · {h.tickets.filter((t) => t.status === "pending").length} pending · {h.tickets.filter(breached).length} past the first-response target
          </p>
        </div>
        <div className="fd-page-actions">
          <Button icon="spark" onClick={() => open("tickets.reassign")}>
            Hand over tickets
          </Button>
        </div>
      </header>
      <Tabs
        label="Queue"
        items={[
          { id: "mine", label: "Mine", count: counts.mine },
          { id: "unassigned", label: "Unassigned", count: counts.unassigned },
          { id: "all", label: "All", count: counts.all },
        ]}
        value={view}
        onChange={(v) => set("view", v)}
      />
      <div className="fd-toolbar">
        <SearchBox value={q} onChange={(v) => set("q", v)} placeholder="Search subject, number, account" label="Search tickets" />
        <div className="fd-row" role="group" aria-label="Priority">
          <Chip selected={!priority} onClick={() => set("priority", "")}>
            Any priority
          </Chip>
          {PRIORITIES.map((p) => (
            <Chip key={p} selected={priority === p} onClick={() => set("priority", priority === p ? "" : p)}>
              {PRIORITY[p]}
            </Chip>
          ))}
        </div>
        <Select size="sm" label="Status" value={status} onChange={(v) => set("status", v)} options={[{ value: "active", label: "Open and pending" }, { value: "open", label: "Open" }, { value: "pending", label: "Pending" }, { value: "solved", label: "Solved" }, { value: "closed", label: "Closed" }, { value: "all", label: "Any status" }]} />
        {account && (
          <Chip selected onClick={() => set("account", "")}>
            {account.name} <Icon name="close" size={12} />
          </Chip>
        )}
        <span className="fd-spacer" />
        <span className="fd-small fd-muted">{plural(rows.length, "ticket")}</span>
      </div>
      <Card padded={false}>
        <DataTable rows={rows} columns={columns} rowKey={(t) => t.id} href={(t) => `/tickets/${t.id}`} caption="Tickets" defaultSort={{ key: "priority", dir: "asc" }} empty={<Empty icon="tickets" title="No tickets here" body={emptyBody} action={view === "mine" && counts.unassigned > 0 ? <Button size="sm" onClick={() => set("view", "unassigned")}>Unassigned ({counts.unassigned})</Button> : undefined} />} />
      </Card>
    </div>
  );
}

/* ---- One ticket ---- */

export function Ticket() {
  const { id } = useParams();
  const { h, store, say, open } = useFoundry();
  const t = h.tickets.find((x) => x.id === id);
  const [reply, setReply] = useState("");
  if (!t) return <Empty icon="tickets" title="That ticket isn't here" action={<Button to="/tickets">All tickets</Button>} />;
  const a = h.accounts.find((x) => x.id === t.accountId)!;
  const hs = health(h, a);
  const assignee = member(h, t.assigneeId);
  const user = me(h);
  const change = (label: string, fn: (d: Tk) => void, said: string) => {
    const undo = store.commit(label, (d) => {
      const x = d.tickets.find((y) => y.id === t.id)!;
      fn(x);
      x.updatedAt = new Date().toISOString();
    });
    say(said, undo);
  };
  const setStatus = (status: TicketStatus) =>
    change(`Ticket ${status}`, (x) => {
      x.status = status;
      if (status === "solved" || status === "closed") {
        if (!h.events.some((e) => e.ref === t.id && e.text.includes(status))) {
          /* the event is added below through the store, so the timeline follows */
        }
      }
    }, `#${t.number} marked ${status}.`);
  const send = (e: FormEvent, solve = false) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    const undo = store.commit("Reply", (d) => {
      const x = d.tickets.find((y) => y.id === t.id)!;
      const now = new Date().toISOString();
      x.messages.push({ id: `msg_${Date.now().toString(36)}`, from: "agent", author: user.name, at: now, body: text });
      if (!x.firstResponseAt) x.firstResponseAt = now;
      if (!x.assigneeId) x.assigneeId = user.id;
      x.status = solve ? "solved" : "pending";
      x.updatedAt = now;
      if (solve) d.events.push({ id: `ev_${Date.now().toString(36)}`, accountId: a.id, at: now, kind: "ticket", text: `Ticket #${x.number} solved: ${x.subject}`, ref: x.id });
    });
    setReply("");
    say(solve ? `Reply sent and #${t.number} solved.` : `Reply sent to ${t.messages[0].author.split(" ")[0]}.`, undo);
  };
  return (
    <div className="fd-page">
      <header className="fd-page-head">
        <div className="fd-page-text">
          <Link className="fd-back" to="/tickets">
            <Icon name="back" size={14} />
            Tickets
          </Link>
          <h1 className="fd-page-title">
            <span className="fd-mono fd-muted" style={{ fontSize: 14 }}>
              #{t.number}
            </span>
            {t.subject}
          </h1>
          <p className="fd-page-desc fd-row" style={{ gap: 8 }}>
            <Badge tone={PRIORITY_TONE[t.priority]} dot>
              {PRIORITY[t.priority]}
            </Badge>
            <Badge tone={STATUS_TONE[t.status]}>{STATUS[t.status]}</Badge>
            <span>
              Opened {shortDate(t.createdAt)} at {time(t.createdAt)} by {t.messages[0].author} · <Sla t={t} />
            </span>
          </p>
        </div>
        <div className="fd-page-actions">
          {isOpen(t) ? (
            <Button variant="default" icon="check" onClick={() => setStatus("solved")}>
              Mark solved
            </Button>
          ) : (
            <Button onClick={() => setStatus("open")}>Reopen</Button>
          )}
          {t.status === "solved" && <Button onClick={() => setStatus("closed")}>Close</Button>}
        </div>
      </header>

      <div className="fd-grid fd-grid-main">
        <Card title="Conversation" description={`${plural(t.messages.length, "message")} with ${a.name}`}>
          <div className="fd-thread">
            {t.messages.map((m) => (
              <div key={m.id} className={`fd-msg${m.from === "agent" ? " fd-msg-agent" : ""}`}>
                <Avatar name={m.author} size={28} />
                <div className="fd-msg-body">
                  <div className="fd-msg-head">
                    <b>{m.author}</b>
                    <span>{m.from === "agent" ? "Basalt" : a.name}</span>
                    <span title={longDate(m.at)}>
                      · {shortDate(m.at)} at {time(m.at)}
                    </span>
                  </div>
                  <div className="fd-msg-text">{m.body}</div>
                </div>
              </div>
            ))}
            <form className="fd-stack" onSubmit={send} style={{ marginTop: 8 }}>
              <Field label={`Reply as ${user.name}`} htmlFor="reply">
                <textarea id="reply" className="fd-textarea" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t.status === "closed" ? "Replying reopens the ticket as pending." : "Write to the customer"} />
              </Field>
              <div className="fd-row">
                <Button type="submit" variant="default" icon="send" disabled={!reply.trim()}>
                  Send reply
                </Button>
                <Button variant="outline" disabled={!reply.trim()} onClick={() => send(new Event("submit") as unknown as FormEvent, true)}>
                  Reply and solve
                </Button>
              </div>
            </form>
          </div>
        </Card>

        <div className="fd-side-panel">
          <Card title="Ticket">
            <div className="fd-stack" style={{ gap: 12 }}>
              <Field label="Assignee" htmlFor="assignee">
                <Select
                  id="assignee"
                  value={t.assigneeId ?? ""}
                  onChange={(v) => change("Assign", (x) => (x.assigneeId = v || null), v ? `#${t.number} assigned to ${member(h, v)?.name.split(" ")[0]}.` : `#${t.number} is now unassigned.`)}
                  options={[{ value: "", label: "Unassigned" }, ...h.team.filter((m) => m.role !== "viewer" && m.status !== "invited").map((m) => ({ value: m.id, label: m.status === "away" ? `${m.name} (away)` : m.name }))]}
                />
              </Field>
              <Field label="Priority" htmlFor="priority">
                <Select id="priority" value={t.priority} onChange={(v) => change("Priority", (x) => (x.priority = v as Priority), `#${t.number} is now ${v} priority.`)} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p] }))} />
              </Field>
              <dl className="fd-kv">
                <dt>Target</dt>
                <dd>{plan(h, a.plan).sla} first response</dd>
                <dt>Due</dt>
                <dd>{dateOnly(t.slaDueAt)} at {time(t.slaDueAt)}</dd>
                <dt>Answered</dt>
                <dd>{t.firstResponseAt ? `${shortDate(t.firstResponseAt)} at ${time(t.firstResponseAt)}` : "Not yet"}</dd>
              </dl>
              {assignee?.status === "away" && (
                <p className="fd-small fd-tone-warning">
                  {assignee.name.split(" ")[0]} is away{assignee.awayUntil ? ` until ${shortDate(assignee.awayUntil)}` : ""}.{" "}
                  <button type="button" className="fd-btn fd-btn-link fd-btn-size-sm" onClick={() => open("tickets.reassign", { from: assignee.id })}>
                    Hand over their tickets
                  </button>
                </p>
              )}
            </div>
          </Card>
          <Card title="Account" actions={<Button variant="ghost" size="sm" to={`/accounts/${a.id}`}>Open</Button>}>
            <div className="fd-stack" style={{ gap: 10 }}>
              <Person name={a.name} detail={`${plan(h, a.plan).name} · ${plural(a.seats, "seat")} · ${a.industry}`} size={32} />
              <div className="fd-row">
                {a.status === "canceled" ? (
                  <Badge tone="neutral">Canceled</Badge>
                ) : (
                  <Badge tone={hs.label === "Healthy" ? "success" : hs.label === "Watch" ? "warning" : "danger"} dot>
                    {hs.label} · {hs.score}
                  </Badge>
                )}
                <span className="fd-small fd-muted">
                  {plural(hs.open, "open ticket")} · renews {shortDate(a.renewalAt)}
                </span>
              </div>
              <div className="fd-row">
                <Button size="sm" icon="spark" onClick={() => open("account.health", { account: a.id })}>
                  {hs.label === "Healthy" ? "Explain health" : "Why at risk"}
                </Button>
                <Button size="sm" variant="ghost" to={`/tickets?view=all&status=all&account=${a.id}`}>
                  All their tickets
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
