import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { customerStats, fullName, netTotal, type Customer as CustomerT } from "../seed.ts";
import { useQuay } from "../session.ts";
import { Avatar, Badge, Button, Card, CardSection, Empty, Field, IndexTable, Page, SearchBox, Tabs, Tag, dateOnly, longDate, money, plural, relative, shortDate, time, type Column } from "../ui.tsx";
import { PaymentBadge, FulfillmentBadge } from "./orders.tsx";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "returning", label: "Returning" },
  { id: "subscribed", label: "Email subscribers" },
];

export function Customers() {
  const { h, open } = useQuay();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "all";
  const q = params.get("q") ?? "";
  const set = (k: string, v: string) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return h.customers
      .map((c) => ({ c, s: customerStats(h, c.id) }))
      .filter(({ c, s }) => (view === "new" ? s.orders <= 1 : view === "returning" ? s.orders >= 2 : view === "subscribed" ? c.subscribed : true))
      .filter(({ c }) => !needle || fullName(c).toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle) || c.address.city.toLowerCase().includes(needle))
      .sort((a, b) => (b.s.last ?? "").localeCompare(a.s.last ?? ""));
  }, [h, view, q]);
  type Row = (typeof rows)[number];
  const all = h.customers.map((c) => ({ c, s: customerStats(h, c.id) }));
  const counts = { all: all.length, new: all.filter((x) => x.s.orders <= 1).length, returning: all.filter((x) => x.s.orders >= 2).length, subscribed: all.filter((x) => x.c.subscribed).length };
  const columns: Column<Row>[] = [
    { key: "name", label: "Customer", sort: (r) => fullName(r.c), render: (r) => (
        <span className="q-entity">
          <Avatar name={fullName(r.c)} size={32} />
          <span className="q-entity-text">
            <span className="q-entity-name">{fullName(r.c)}</span>
            <span className="q-entity-sub">{r.c.email}</span>
          </span>
        </span>
      ) },
    { key: "subscription", label: "Email subscription", render: (r) => <Badge tone={r.c.subscribed ? "success" : "neutral"}>{r.c.subscribed ? "Subscribed" : "Not subscribed"}</Badge>, secondary: true },
    { key: "location", label: "Location", sort: (r) => r.c.address.state, render: (r) => `${r.c.address.city}, ${r.c.address.state}` },
    { key: "orders", label: "Orders", align: "end", sort: (r) => r.s.orders, render: (r) => <span className="q-tabular">{plural(r.s.orders, "order")}</span> },
    { key: "spent", label: "Amount spent", align: "end", sort: (r) => r.s.spent, render: (r) => <span className="q-tabular">{money(r.s.spent)}</span> },
  ];
  return (
    <Page title="Customers" fullWidth actions={<Button icon="spark" onClick={() => open("discount.create", { audience: "returning", percent: 15 })}>Make a discount for returning customers</Button>}>
      <Card padded={false}>
        <Tabs label="Saved views" items={VIEWS.map((v) => ({ ...v, count: counts[v.id as keyof typeof counts] }))} value={view} onChange={(v) => set("view", v === "all" ? "" : v)} />
        <div className="q-toolbar">
          <SearchBox value={q} onChange={(v) => set("q", v)} placeholder="Search name, email or city" label="Search customers" />
          <span className="q-spacer" />
          <span className="q-small q-muted">{plural(rows.length, "customer")}</span>
        </div>
        <IndexTable rows={rows} columns={columns} rowKey={(r) => r.c.id} rowName={(r) => fullName(r.c)} href={(r) => `/customers/${r.c.id}`} caption="Customers" empty={<Empty icon="customers" title="No customers match" body="Fewer words, or another view." />} />
      </Card>
    </Page>
  );
}

export function Customer() {
  const { id } = useParams();
  const { h, store, say, open } = useQuay();
  const c = h.customers.find((x) => x.id === id);
  const [note, setNote] = useState("");
  const [tagText, setTagText] = useState("");
  if (!c) return <Empty icon="customers" title="That customer isn't here" action={<Button to="/customers">All customers</Button>} />;
  const s = customerStats(h, c.id);
  const orders = h.orders.filter((o) => o.customerId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const last = orders[0];
  const addNote = (e: FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    const undo = store.commit("Customer note", (d) => void d.customers.find((x) => x.id === c.id)!.notes.unshift({ id: `note_${Date.now().toString(36)}`, at: new Date().toISOString(), body: text }));
    setNote("");
    say(`Note added to ${fullName(c)}.`, undo);
  };
  const toggleSubscribed = () => {
    const undo = store.commit("Marketing", (d) => {
      const dc = d.customers.find((x) => x.id === c.id)!;
      dc.subscribed = !dc.subscribed;
    });
    say(c.subscribed ? `${c.firstName} is unsubscribed from email marketing.` : `${c.firstName} is subscribed to email marketing.`, undo);
  };
  const addTag = (e: FormEvent) => {
    e.preventDefault();
    const t = tagText.trim().toLowerCase();
    if (!t || c.tags.includes(t)) return setTagText("");
    const undo = store.commit("Tag customer", (d) => void d.customers.find((x) => x.id === c.id)!.tags.push(t));
    setTagText("");
    say(`Tagged with "${t}".`, undo);
  };
  const removeTag = (t: string) => {
    const undo = store.commit("Untag customer", (d) => {
      const dc = d.customers.find((x) => x.id === c.id)!;
      dc.tags = dc.tags.filter((x) => x !== t);
    });
    say(`Removed "${t}".`, undo);
  };
  const since = Math.round((Date.now() - new Date(c.createdAt).getTime()) / (86400000 * 30.4));
  return (
    <Page back={{ to: "/customers", label: "Customers" }} title={fullName(c)} titleMeta={<Badge tone={s.returning ? "info" : "neutral"}>{s.returning ? "Returning" : "New"}</Badge>} subtitle={`${c.address.city}, ${c.address.state} · Customer for ${since < 1 ? "less than a month" : since < 12 ? plural(since, "month") : `${Math.round(since / 12)} year${Math.round(since / 12) === 1 ? "" : "s"}`}`} secondary={<Button to={`mailto:${c.email}`} icon="mail">Email customer</Button>} actions={last && last.paymentStatus !== "refunded" && last.status !== "canceled" ? <Button icon="spark" onClick={() => open("order.refund", { orderId: last.id })}>Refund last order</Button> : undefined}>
      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          <div className="q-stats">
            <div className="q-stat">
              <span className="q-stat-label">Amount spent</span>
              <span className="q-stat-value">{money(s.spent)}</span>
            </div>
            <div className="q-stat">
              <span className="q-stat-label">Orders</span>
              <span className="q-stat-value">{s.orders}</span>
            </div>
            <div className="q-stat">
              <span className="q-stat-label">Average order</span>
              <span className="q-stat-value">{money(s.orders ? s.spent / s.orders : 0)}</span>
            </div>
          </div>
          {last ? (
            <Card title="Last order placed" actions={<Button variant="plain" to={`/orders/${last.id}`}>View order</Button>}>
              <div className="q-stack" style={{ gap: 4 }}>
                <span className="q-row">
                  <Link to={`/orders/${last.id}`} className="q-link q-strong">
                    #{last.number}
                  </Link>
                  <PaymentBadge order={last} />
                  <FulfillmentBadge order={last} />
                </span>
                <span className="q-muted">
                  {dateOnly(last.createdAt)} at {time(last.createdAt)} · {money(last.total)}
                </span>
                <span className="q-muted">{last.items.map((it) => `${it.qty} × ${it.title}`).join(", ")}</span>
              </div>
            </Card>
          ) : (
            <Card title="Orders">
              <Empty icon="orders" title="No orders yet" body={`${c.firstName} ${c.subscribed ? "is on the mailing list but hasn't" : "signed up but hasn't"} ordered.`} />
            </Card>
          )}
          {orders.length > 1 && (
            <Card title={`All orders (${orders.length})`} padded={false}>
              <IndexTable
                rows={orders}
                rowKey={(o) => o.id}
                href={(o) => `/orders/${o.id}`}
                caption={`Orders by ${fullName(c)}`}
                columns={[
                  { key: "number", label: "Order", render: (o) => <span className={`q-strong${o.status === "canceled" ? " q-strike" : ""}`}>#{o.number}</span> },
                  { key: "date", label: "Date", sort: (o) => o.createdAt, render: (o) => <span title={longDate(o.createdAt)}>{shortDate(o.createdAt)}</span> },
                  { key: "payment", label: "Payment", render: (o) => <PaymentBadge order={o} /> },
                  { key: "fulfillment", label: "Fulfillment", render: (o) => <FulfillmentBadge order={o} />, secondary: true },
                  { key: "total", label: "Total", align: "end", render: (o) => <span className="q-tabular">{money(netTotal(o))}</span> },
                ]}
                empty={<Empty icon="orders" title="No orders" />}
              />
            </Card>
          )}
          <Card title="Timeline">
            <div className="q-stack q-stack-loose">
              <form className="q-row" onSubmit={addNote} style={{ flexWrap: "nowrap" }}>
                <input className="q-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave a note…" aria-label="Note" />
                <Button type="submit" disabled={!note.trim()}>
                  Post
                </Button>
              </form>
              {c.notes.length ? (
                <ul className="q-timeline">
                  {c.notes.map((n) => (
                    <li key={n.id} className="q-tl-item q-tl-comment">
                      <span className="q-tl-icon">
                        <Avatar name={h.shop.owner.name} size={22} />
                      </span>
                      <span className="q-tl-text">{n.body}</span>
                      <span className="q-tl-when">{relative(n.at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="q-small q-muted">Notes are only visible to staff.</p>
              )}
            </div>
          </Card>
        </div>
        <div className="q-stack q-stack-loose">
          <Card padded={false}>
            <CardSection title="Customer">
              <div className="q-stack" style={{ gap: 2 }}>
                <a href={`mailto:${c.email}`} className="q-link">
                  {c.email}
                </a>
                <span className="q-muted">{c.phone ?? "No phone number"}</span>
              </div>
            </CardSection>
            <CardSection title="Default address">
              <div className="q-stack" style={{ gap: 0 }}>
                <span>{c.address.name}</span>
                <span>{c.address.line1}</span>
                {c.address.line2 && <span>{c.address.line2}</span>}
                <span>
                  {c.address.city}, {c.address.state} {c.address.zip}
                </span>
                <span>{c.address.country}</span>
              </div>
            </CardSection>
            <CardSection title="Marketing">
              <div className="q-row q-between">
                <Badge tone={c.subscribed ? "success" : "neutral"}>{c.subscribed ? "Email subscribed" : "Email not subscribed"}</Badge>
                <Button size="slim" onClick={toggleSubscribed}>
                  {c.subscribed ? "Unsubscribe" : "Subscribe"}
                </Button>
              </div>
            </CardSection>
          </Card>
          <Card title="Tags">
            <div className="q-stack">
              <form className="q-row" onSubmit={addTag} style={{ flexWrap: "nowrap" }}>
                <input className="q-input" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" />
                <Button type="submit" disabled={!tagText.trim()}>
                  Add
                </Button>
              </form>
              {c.tags.length > 0 && (
                <div className="q-row">
                  {c.tags.map((t) => (
                    <Tag key={t} onRemove={() => removeTag(t)}>
                      {t}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card title="Customer since">
            <Field label="First seen">
              <span>{dateOnly(c.createdAt)}</span>
            </Field>
            {s.first && (
              <Field label="First order">
                <span>{dateOnly(s.first)}</span>
              </Field>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}

export type { CustomerT };
