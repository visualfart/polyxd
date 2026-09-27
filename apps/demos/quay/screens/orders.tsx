import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FULFILLMENT_LABEL, PAYMENT_LABEL, customer, customerStats, fullName, isLate, netTotal, promisedShip, refundedTotal, unfulfilledItems, type DraftOrder, type Order as OrderT } from "../seed.ts";
import { useQuay } from "../session.ts";
import { Badge, Button, Card, CardSection, Checkbox, Empty, Field, IndexTable, Modal, Page, SearchBox, Select, Tabs, Tag, Thumb, Timeline, dateOnly, isoDay, longDate, money, plural, relative, shortDate, time, type Column } from "../ui.tsx";

const PAY_TONE = { paid: "neutral", pending: "warning", partially_refunded: "neutral", refunded: "neutral" } as const;
export function PaymentBadge({ order }: { order: OrderT }) {
  if (order.status === "canceled") return <Badge tone="danger">Canceled</Badge>;
  return (
    <Badge tone={PAY_TONE[order.paymentStatus]} progress={order.paymentStatus === "paid" ? "complete" : order.paymentStatus === "pending" ? "incomplete" : "partial"}>
      {PAYMENT_LABEL[order.paymentStatus]}
    </Badge>
  );
}
export function FulfillmentBadge({ order }: { order: OrderT }) {
  if (order.status === "canceled") return null;
  const s = order.fulfillmentStatus;
  return (
    <Badge tone={s === "fulfilled" ? "neutral" : "warning"} progress={s === "fulfilled" ? "complete" : s === "partial" ? "partial" : "incomplete"}>
      {FULFILLMENT_LABEL[s]}
    </Badge>
  );
}

const VIEWS = [
  { id: "all", label: "All" },
  { id: "unfulfilled", label: "Unfulfilled" },
  { id: "unpaid", label: "Unpaid" },
  { id: "open", label: "Open" },
  { id: "archived", label: "Archived" },
];
const inView = (o: OrderT, view: string) => (view === "unfulfilled" ? o.status === "open" && o.fulfillmentStatus !== "fulfilled" : view === "unpaid" ? o.status !== "canceled" && o.paymentStatus === "pending" : view === "open" ? o.status === "open" : view === "archived" ? o.status === "archived" : true);
const DATE_WINDOWS: Record<string, number> = { today: 0, "7": 6, "30": 29, "90": 89 };

/** A real CSV of the rows on screen, the way Export does in a store admin. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Orders() {
  const { h, open, store, say } = useQuay();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "all";
  const q = params.get("q") ?? "";
  const payF = params.get("payment") ?? "";
  const fulF = params.get("fulfillment") ?? "";
  const dateF = params.get("date") ?? "";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const set = (k: string, v: string) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, "");
    const since = dateF in DATE_WINDOWS ? isoDay(new Date(Date.now() - DATE_WINDOWS[dateF] * 86400000)) : "";
    return h.orders
      .map((o) => ({ o, c: customer(h, o.customerId) }))
      .filter(({ o }) => inView(o, view))
      .filter(({ o }) => !payF || o.paymentStatus === payF)
      .filter(({ o }) => !fulF || (fulF === "unfulfilled" ? o.fulfillmentStatus !== "fulfilled" : o.fulfillmentStatus === fulF))
      .filter(({ o }) => !since || isoDay(o.createdAt) >= since)
      .filter(({ o, c }) => !needle || String(o.number).includes(needle) || (c && (fullName(c).toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle))) || o.items.some((it) => it.title.toLowerCase().includes(needle)))
      .sort((a, b) => b.o.createdAt.localeCompare(a.o.createdAt));
  }, [h, view, q, payF, fulF, dateF]);
  type Row = (typeof rows)[number];
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, h.orders.filter((o) => inView(o, v.id)).length]));
  const chosen = rows.filter((r) => selected.has(r.o.id)).map((r) => r.o);
  const fulfillable = chosen.filter((o) => o.status === "open" && o.fulfillmentStatus !== "fulfilled");

  const columns: Column<Row>[] = [
    { key: "number", label: "Order", sort: (r) => r.o.number, render: (r) => <span className={`q-strong${r.o.status === "canceled" ? " q-strike" : ""}`}>#{r.o.number}</span>, width: "90px" },
    { key: "date", label: "Date", sort: (r) => r.o.createdAt, render: (r) => <span title={longDate(r.o.createdAt)}>{relative(r.o.createdAt)}</span> },
    { key: "customer", label: "Customer", sort: (r) => (r.c ? fullName(r.c) : ""), render: (r) => (r.c ? fullName(r.c) : <span className="q-muted">Guest</span>) },
    { key: "total", label: "Total", align: "end", sort: (r) => r.o.total, render: (r) => <span className="q-tabular">{money(r.o.total)}</span> },
    { key: "payment", label: "Payment status", sort: (r) => r.o.paymentStatus, render: (r) => <PaymentBadge order={r.o} /> },
    { key: "fulfillment", label: "Fulfillment status", sort: (r) => r.o.fulfillmentStatus, render: (r) => <FulfillmentBadge order={r.o} /> },
    { key: "items", label: "Items", align: "end", sort: (r) => r.o.items.reduce((s, it) => s + it.qty, 0), render: (r) => <span className="q-tabular">{plural(r.o.items.reduce((s, it) => s + it.qty, 0), "item")}</span>, secondary: true },
    { key: "delivery", label: "Delivery method", render: (r) => (r.o.shipping === 0 ? "Free shipping" : "Standard shipping"), secondary: true },
    { key: "tags", label: "Tags", render: (r) => r.o.tags.join(", ") || <span className="q-muted">–</span>, secondary: true },
  ];
  const filtered = Boolean(q || payF || fulF || dateF);
  const clear = () => setParams((p) => (["q", "payment", "fulfillment", "date"].forEach((k) => p.delete(k)), p));

  const bulkPrint = () => {
    const undo = store.commit("Print packing slips", (d) => {
      for (const o of d.orders) if (selected.has(o.id)) (o.printedAt = new Date().toISOString()), o.timeline.push({ id: `ev_${Date.now().toString(36)}${o.number}`, at: new Date().toISOString(), kind: "print", text: "Packing slip printed" });
    });
    say(`${plural(selected.size, "packing slip")} sent to the printer.`, undo);
    setSelected(new Set());
  };
  const bulkArchive = () => {
    const ids = chosen.filter((o) => o.status === "open" && o.fulfillmentStatus === "fulfilled").map((o) => o.id);
    if (!ids.length) return say("Only fulfilled, open orders can be archived.");
    const undo = store.commit("Archive orders", (d) => {
      for (const o of d.orders) if (ids.includes(o.id)) (o.status = "archived"), o.timeline.push({ id: `ev_${Date.now().toString(36)}${o.number}`, at: new Date().toISOString(), kind: "archived", text: "Order archived" });
    });
    say(`${plural(ids.length, "order")} archived.`, undo);
    setSelected(new Set());
  };
  const exportCsv = () => {
    const lines = [["Order", "Date", "Customer", "Email", "Total", "Payment status", "Fulfillment status", "Items"].join(",")];
    for (const { o, c } of rows) lines.push([`#${o.number}`, isoDay(o.createdAt), c ? fullName(c) : "", c?.email ?? "", o.total.toFixed(2), PAYMENT_LABEL[o.paymentStatus], FULFILLMENT_LABEL[o.fulfillmentStatus], o.items.reduce((s, it) => s + it.qty, 0)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    download(`orders-${isoDay(new Date())}.csv`, lines.join("\n"));
    say(`Exported ${plural(rows.length, "order")} as CSV.`);
  };

  return (
    <Page title="Orders" fullWidth actions={<Button icon="spark" onClick={() => open("orders.late")}>Which orders are stuck?</Button>} secondary={<Button onClick={exportCsv}>Export</Button>}>
      <Card padded={false}>
        <Tabs label="Saved views" items={VIEWS.map((v) => ({ ...v, count: counts[v.id] }))} value={view} onChange={(v) => set("view", v === "all" ? "" : v)} />
        <div className="q-toolbar">
          <SearchBox value={q} onChange={(v) => set("q", v)} placeholder="Search order number, customer or product" label="Search orders" />
          <Select slim label="Payment status" value={payF} onChange={(v) => set("payment", v)} options={[{ value: "", label: "Payment status" }, ...Object.entries(PAYMENT_LABEL).map(([value, label]) => ({ value, label }))]} />
          <Select slim label="Fulfillment status" value={fulF} onChange={(v) => set("fulfillment", v)} options={[{ value: "", label: "Fulfillment status" }, { value: "unfulfilled", label: "Unfulfilled" }, { value: "partial", label: "Partially fulfilled" }, { value: "fulfilled", label: "Fulfilled" }]} />
          <Select slim label="Date" value={dateF} onChange={(v) => set("date", v)} options={[{ value: "", label: "Any date" }, { value: "today", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]} />
          {filtered && (
            <Button variant="tertiary" size="slim" onClick={clear}>
              Clear all
            </Button>
          )}
          <span className="q-spacer" />
          <span className="q-small q-muted">{plural(rows.length, "order")}</span>
        </div>
        <IndexTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.o.id}
          rowName={(r) => `order #${r.o.number}`}
          href={(r) => `/orders/${r.o.id}`}
          caption="Orders"
          selectable
          selected={selected}
          onSelect={setSelected}
          bulk={
            <>
              <Button size="slim" variant="primary" disabled={!fulfillable.length} onClick={() => open("orders.fulfill.confirm", { orderIds: fulfillable.map((o) => o.id) })}>
                Fulfill {fulfillable.length ? `(${fulfillable.length})` : ""}
              </Button>
              <Button size="slim" icon="print" onClick={bulkPrint}>
                Print packing slips
              </Button>
              <Button size="slim" icon="archive" onClick={bulkArchive}>
                Archive
              </Button>
            </>
          }
          empty={<Empty icon="orders" title="No orders match" body={filtered ? "Fewer words, or clear a filter." : view === "unfulfilled" ? "Everything has shipped. New orders land here as they come in." : view === "unpaid" ? "Every order is paid." : "Nothing in this view."} action={filtered ? <Button size="slim" onClick={clear}>Clear filters</Button> : undefined} />}
        />
      </Card>
    </Page>
  );
}

/* ---- One order ---- */

export function Order() {
  const { id } = useParams();
  const { h, open, store, say } = useQuay();
  const navigate = useNavigate();
  const o = h.orders.find((x) => x.id === id);
  const [comment, setComment] = useState("");
  const [cancel, setCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("Customer changed their mind");
  const [restockOnCancel, setRestockOnCancel] = useState(true);
  const [noteEdit, setNoteEdit] = useState<string | null>(null);
  const [tagText, setTagText] = useState("");
  if (!o) return <Empty icon="orders" title="That order isn't here" body="It may have been removed when the demo was reset." action={<Button to="/orders">All orders</Button>} />;
  const c = customer(h, o.customerId);
  const stats = c ? customerStats(h, c.id) : undefined;
  const remaining = unfulfilledItems(o);
  const fulfilled = o.items.filter((it) => it.fulfilled > 0);
  const refunded = refundedTotal(o);
  const stamp = () => new Date().toISOString();
  const ev = (kind: OrderT["timeline"][number]["kind"], text: string, author?: string) => ({ id: `ev_${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`, at: stamp(), kind, text, author });

  const addComment = (e: FormEvent) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    const undo = store.commit("Comment", (d) => void d.orders.find((x) => x.id === o.id)!.timeline.push(ev("comment", text, h.shop.owner.name)));
    setComment("");
    say("Comment added to the timeline.", undo);
  };
  const print = () => {
    const undo = store.commit("Print", (d) => {
      const dd = d.orders.find((x) => x.id === o.id)!;
      dd.printedAt = stamp();
      dd.timeline.push(ev("print", "Packing slip printed"));
    });
    say(`Packing slip for #${o.number} sent to the printer.`, undo);
  };
  const markPaid = () => {
    const undo = store.commit("Mark as paid", (d) => {
      const dd = d.orders.find((x) => x.id === o.id)!;
      dd.paymentStatus = "paid";
      dd.timeline.push(ev("paid", `Payment of ${money(o.total)} marked as received (bank deposit)`));
    });
    say(`#${o.number} marked as paid.`, undo);
  };
  const archive = (on: boolean) => {
    const undo = store.commit(on ? "Archive" : "Unarchive", (d) => {
      const dd = d.orders.find((x) => x.id === o.id)!;
      dd.status = on ? "archived" : "open";
      dd.timeline.push(ev("archived", on ? "Order archived" : "Order unarchived"));
    });
    say(on ? `#${o.number} archived.` : `#${o.number} is open again.`, undo);
  };
  const doCancel = () => {
    store.commit("Cancel order", (d) => {
      const dd = d.orders.find((x) => x.id === o.id)!;
      dd.status = "canceled";
      dd.canceledAt = stamp();
      dd.cancelReason = cancelReason;
      const already = dd.refunds.reduce((s, r) => s + r.amount, 0);
      const amount = Math.round((dd.total - already) * 100) / 100;
      if (dd.paymentStatus !== "pending" && amount > 0) {
        dd.refunds.push({ id: `rf_${Date.now().toString(36)}`, at: stamp(), amount, reason: cancelReason, items: dd.items.map((it) => ({ lineItemId: it.id, qty: it.qty - it.refunded })), restocked: restockOnCancel });
        dd.paymentStatus = "refunded";
      }
      if (restockOnCancel) for (const it of dd.items) for (const p of d.products) for (const v of p.variants) if (v.id === it.variantId) v.inventory += it.qty - it.refunded;
      for (const it of dd.items) it.refunded = it.qty;
      dd.timeline.push(ev("canceled", `Order canceled: ${cancelReason.toLowerCase()}.${amount > 0 && o.paymentStatus !== "pending" ? ` ${money(amount)} refunded.` : ""}${restockOnCancel ? " Items restocked." : ""}`));
      dd.timeline.push(ev("email", `Cancellation emailed to ${c?.email ?? "the customer"}`));
    });
    setCancel(false);
    say(`#${o.number} canceled${o.paymentStatus !== "pending" ? ` and ${money(o.total - refunded)} refunded` : ""}. ${c ? c.firstName : "The customer"} has been emailed.`);
  };
  const saveNote = () => {
    const text = (noteEdit ?? "").trim();
    const undo = store.commit("Note", (d) => void (d.orders.find((x) => x.id === o.id)!.note = text || undefined));
    setNoteEdit(null);
    say(text ? "Note saved." : "Note removed.", undo);
  };
  const addTag = (e: FormEvent) => {
    e.preventDefault();
    const t = tagText.trim().toLowerCase();
    if (!t || o.tags.includes(t)) return setTagText("");
    const undo = store.commit("Tag", (d) => void d.orders.find((x) => x.id === o.id)!.tags.push(t));
    setTagText("");
    say(`Tagged #${o.number} with "${t}".`, undo);
  };
  const removeTag = (t: string) => {
    const undo = store.commit("Untag", (d) => {
      const dd = d.orders.find((x) => x.id === o.id)!;
      dd.tags = dd.tags.filter((x) => x !== t);
    });
    say(`Removed "${t}".`, undo);
  };
  const late = isLate(o);
  const canRefund = o.status !== "canceled" && o.paymentStatus !== "pending" && o.paymentStatus !== "refunded";

  return (
    <Page
      back={{ to: "/orders", label: "Orders" }}
      title={`#${o.number}`}
      titleMeta={
        <>
          <PaymentBadge order={o} />
          <FulfillmentBadge order={o} />
          {o.status === "archived" && <Badge>Archived</Badge>}
        </>
      }
      subtitle={`${dateOnly(o.createdAt)} at ${time(o.createdAt)} from Online Store`}
      secondary={
        <>
          {canRefund && (
            <Button icon="spark" onClick={() => open("order.refund", { orderId: o.id })}>
              Refund
            </Button>
          )}
          <Button icon="print" onClick={print}>
            Print
          </Button>
          {o.paymentStatus === "pending" && o.status === "open" && <Button onClick={markPaid}>Mark as paid</Button>}
          {o.status === "open" && o.fulfillmentStatus === "fulfilled" && <Button onClick={() => archive(true)}>Archive</Button>}
          {o.status === "archived" && <Button onClick={() => archive(false)}>Unarchive</Button>}
          {o.status === "open" && (
            <Button variant="tertiary" onClick={() => setCancel(true)}>
              Cancel order
            </Button>
          )}
        </>
      }
      actions={
        o.status === "open" && remaining.length ? (
          <Button variant="primary" onClick={() => open("orders.fulfill.confirm", { orderIds: [o.id] })}>
            Fulfill items
          </Button>
        ) : undefined
      }
    >
      {late && <Badge tone="danger">Late: promised {relative(o.promisedShipAt)}</Badge>}
      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          {remaining.length > 0 && o.status !== "canceled" && (
            <Card padded={false}>
              <CardSection title={<><Badge tone="warning" progress="incomplete">Unfulfilled</Badge> ({remaining.reduce((s, it) => s + it.qty - it.fulfilled, 0)})</>}>
                <p className="q-small q-muted" style={{ marginBottom: 8 }}>
                  Promised by {dateOnly(o.promisedShipAt)} · {o.shipping === 0 ? "Free shipping" : "Standard shipping"} to {o.shippingAddress.city}, {o.shippingAddress.state}
                </p>
                <Items items={remaining} qty={(it) => it.qty - it.fulfilled} />
                <div className="q-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                  <Button variant="primary" onClick={() => open("orders.fulfill.confirm", { orderIds: [o.id] })}>
                    Fulfill items
                  </Button>
                </div>
              </CardSection>
            </Card>
          )}
          {fulfilled.length > 0 && (
            <Card padded={false}>
              <CardSection title={<><Badge progress="complete">Fulfilled</Badge> ({fulfilled.reduce((s, it) => s + it.fulfilled, 0)})</>}>
                {o.tracking && (
                  <p className="q-small q-muted" style={{ marginBottom: 8 }}>
                    {o.fulfilledAt ? `${dateOnly(o.fulfilledAt)} · ` : ""}USPS · tracking <span className="q-mono">{o.tracking}</span>
                  </p>
                )}
                <Items items={fulfilled} qty={(it) => it.fulfilled} />
              </CardSection>
            </Card>
          )}
          {o.status === "canceled" && (
            <Card padded={false}>
              <CardSection title={<><Badge tone="danger">Canceled</Badge> {o.canceledAt ? dateOnly(o.canceledAt) : ""}</>}>
                <p className="q-muted" style={{ marginBottom: 8 }}>{o.cancelReason}</p>
                <Items items={o.items} qty={(it) => it.qty} />
              </CardSection>
            </Card>
          )}
          <Card padded={false}>
            <CardSection title={<><PaymentBadge order={o} /></>}>
              <dl className="q-receipt">
                <dt>Subtotal</dt>
                <dd className="q-receipt-note">{plural(o.items.reduce((s, it) => s + it.qty, 0), "item")}</dd>
                <dd>{money(o.subtotal)}</dd>
                {o.discountCode && (
                  <>
                    <dt>Discount</dt>
                    <dd className="q-receipt-note">{o.discountCode}</dd>
                    <dd>-{money(o.discountAmount)}</dd>
                  </>
                )}
                <dt>Shipping</dt>
                <dd className="q-receipt-note">{o.shipping === 0 ? "Free shipping" : "Standard"}</dd>
                <dd>{money(o.shipping)}</dd>
                <dt>Tax</dt>
                <dd className="q-receipt-note">{o.shippingAddress.state} {o.tax ? `${Math.round((o.tax / (o.subtotal - o.discountAmount)) * 10000) / 100}%` : "no sales tax"}</dd>
                <dd>{money(o.tax)}</dd>
                <dt className="is-total">Total</dt>
                <dd className="is-total" />
                <dd className="is-total">{money(o.total)}</dd>
              </dl>
            </CardSection>
            <CardSection subdued>
              <dl className="q-receipt">
                <dt>Paid by customer</dt>
                <dd className="q-receipt-note">{o.paymentStatus === "pending" ? "Bank deposit, not yet received" : "Visa"}</dd>
                <dd>{money(o.paymentStatus === "pending" ? 0 : o.total)}</dd>
                {o.refunds.map((r) => (
                  <span key={r.id} style={{ display: "contents" }}>
                    <dt>Refunded</dt>
                    <dd className="q-receipt-note">
                      {shortDate(r.at)} · {r.reason}
                    </dd>
                    <dd>-{money(r.amount)}</dd>
                  </span>
                ))}
                {refunded > 0 && (
                  <>
                    <dt className="is-total">Net payment</dt>
                    <dd className="is-total" />
                    <dd className="is-total">{money(netTotal(o))}</dd>
                  </>
                )}
              </dl>
            </CardSection>
          </Card>
          <Card title="Timeline">
            <div className="q-stack q-stack-loose">
              <form className="q-row" onSubmit={addComment} style={{ flexWrap: "nowrap" }}>
                <input className="q-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a comment…" aria-label="Comment" />
                <Button type="submit" disabled={!comment.trim()}>
                  Post
                </Button>
              </form>
              <p className="q-small q-muted">Only you and other staff can see comments.</p>
              <Timeline events={o.timeline} format={(iso) => `${shortDate(iso)}, ${time(iso)}`} />
            </div>
          </Card>
        </div>
        <div className="q-stack q-stack-loose">
          <Card title="Notes" actions={noteEdit === null ? <Button variant="plain" onClick={() => setNoteEdit(o.note ?? "")}>{o.note ? "Edit" : "Add"}</Button> : undefined}>
            {noteEdit !== null ? (
              <div className="q-stack">
                <textarea className="q-textarea" value={noteEdit} onChange={(e) => setNoteEdit(e.target.value)} aria-label="Order note" />
                <div className="q-row" style={{ justifyContent: "flex-end" }}>
                  <Button variant="tertiary" size="slim" onClick={() => setNoteEdit(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="slim" onClick={saveNote}>
                    Save
                  </Button>
                </div>
              </div>
            ) : o.note ? (
              <p style={{ whiteSpace: "pre-wrap" }}>{o.note}</p>
            ) : (
              <p className="q-muted">No notes from customer</p>
            )}
          </Card>
          <Card padded={false}>
            <CardSection title="Customer">
              {c ? (
                <div className="q-stack" style={{ gap: 2 }}>
                  <Link to={`/customers/${c.id}`} className="q-link">
                    {fullName(c)}
                  </Link>
                  <span className="q-muted">{stats ? plural(stats.orders, "order") : ""}</span>
                </div>
              ) : (
                <span className="q-muted">Guest checkout</span>
              )}
            </CardSection>
            <CardSection title="Contact information">
              <div className="q-stack" style={{ gap: 2 }}>
                {c ? (
                  <a href={`mailto:${c.email}`} className="q-link">
                    {c.email}
                  </a>
                ) : (
                  <span className="q-muted">No email</span>
                )}
                <span className="q-muted">{c?.phone ?? "No phone number"}</span>
              </div>
            </CardSection>
            <CardSection title="Shipping address">
              <AddressLines a={o.shippingAddress} />
            </CardSection>
            <CardSection title="Billing address">{o.billingSame ? <span className="q-muted">Same as shipping address</span> : <AddressLines a={{ ...o.shippingAddress, line1: `${o.shippingAddress.line1.split(" ")[0]} ${o.shippingAddress.line1.split(" ").slice(1).join(" ")}` }} />}</CardSection>
          </Card>
          <Card title="Tags">
            <div className="q-stack">
              <form className="q-row" onSubmit={addTag} style={{ flexWrap: "nowrap" }}>
                <input className="q-input" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" />
                <Button type="submit" size="default" disabled={!tagText.trim()}>
                  Add
                </Button>
              </form>
              {o.tags.length > 0 && (
                <div className="q-row">
                  {o.tags.map((t) => (
                    <Tag key={t} onRemove={() => removeTag(t)}>
                      {t}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card title="Conversion summary">
            <p className="q-small q-muted">
              This order came from {o.source === "ads" ? "a paid ad" : o.source === "organic" ? "organic search" : o.source === "email" ? "an email" : o.source === "social" ? "social" : "a direct visit"}. {stats && stats.orders > 1 ? `${c!.firstName} has ordered ${plural(stats.orders, "time")} for ${money(stats.spent)}.` : "First order from this customer."}
            </p>
          </Card>
        </div>
      </div>
      {cancel && (
        <Modal
          title={`Cancel order #${o.number}?`}
          onClose={() => setCancel(false)}
          tone="danger"
          secondary={<Button onClick={() => setCancel(false)}>Keep order</Button>}
          primary={
            <Button variant="critical" onClick={doCancel}>
              Cancel order
            </Button>
          }
        >
          <p>
            {o.paymentStatus === "pending" ? "No payment was received, so nothing is refunded." : `${money(o.total - refunded)} is refunded to the original payment method.`} {c ? `${c.firstName} is emailed.` : "The customer is emailed."} This can't be undone.
          </p>
          <Field label="Reason" htmlFor="cancel-reason">
            <Select id="cancel-reason" value={cancelReason} onChange={setCancelReason} options={["Customer changed their mind", "Ordered by mistake", "Fraudulent order", "Item unavailable", "Other"].map((r) => ({ value: r, label: r }))} />
          </Field>
          <Checkbox checked={restockOnCancel} onChange={setRestockOnCancel} label="Restock items" description="Puts the items back into available inventory." />
        </Modal>
      )}
    </Page>
  );
}

function AddressLines({ a }: { a: OrderT["shippingAddress"] }) {
  return (
    <div className="q-stack" style={{ gap: 0 }}>
      <span>{a.name}</span>
      <span>{a.line1}</span>
      {a.line2 && <span>{a.line2}</span>}
      <span>
        {a.city}, {a.state} {a.zip}
      </span>
      <span>{a.country}</span>
    </div>
  );
}

function Items({ items, qty }: { items: OrderT["items"]; qty: (it: OrderT["items"][number]) => number }) {
  return (
    <ul className="q-list">
      {items.map((it) => (
        <li key={it.id} className="q-li">
          <Thumb media={it.media} size={40} />
          <span className="q-li-text">
            <Link to={`/products/${it.productId}`} className="q-li-title q-link">
              {it.title}
            </Link>
            <span className="q-li-sub">
              {it.variantTitle !== "Default" ? `${it.variantTitle} · ` : ""}SKU: {it.sku}
            </span>
          </span>
          <span className="q-li-trailing q-tabular">
            <span className="q-muted">
              {money(it.price)} × {qty(it)}
            </span>
            <span style={{ minWidth: 64, textAlign: "right" }}>{money(it.price * qty(it))}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---- Draft orders ---- */

const DRAFT_LABEL: Record<DraftOrder["status"], string> = { open: "Open", invoice_sent: "Invoice sent", completed: "Completed" };

export function Drafts() {
  const { h } = useQuay();
  const rows = [...h.drafts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Page title="Draft orders" subtitle="Orders you create for a customer: wholesale, phone orders, invoices." back={{ to: "/orders", label: "Orders" }}>
      <Card padded={false}>
        <IndexTable
          rows={rows}
          rowKey={(d) => d.id}
          href={(d) => `/orders/drafts/${d.id}`}
          caption="Draft orders"
          columns={[
            { key: "number", label: "Draft", render: (d) => <span className="q-strong">#D{d.number}</span>, width: "90px" },
            { key: "date", label: "Date", sort: (d) => d.createdAt, render: (d) => shortDate(d.createdAt) },
            { key: "customer", label: "Customer", render: (d) => fullName(customer(h, d.customerId)!) },
            { key: "status", label: "Status", render: (d) => <Badge tone={d.status === "completed" ? "success" : d.status === "invoice_sent" ? "info" : "neutral"}>{DRAFT_LABEL[d.status]}</Badge> },
            { key: "total", label: "Total", align: "end", render: (d) => <span className="q-tabular">{money(d.total)}</span> },
          ]}
          empty={<Empty icon="note" title="No draft orders" body="Create one when a customer orders by phone or email." />}
        />
      </Card>
    </Page>
  );
}

export function Draft() {
  const { id } = useParams();
  const { h, store, say } = useQuay();
  const navigate = useNavigate();
  const [remove, setRemove] = useState(false);
  const d = h.drafts.find((x) => x.id === id);
  if (!d) return <Empty icon="note" title="That draft isn't here" action={<Button to="/orders/drafts">All drafts</Button>} />;
  const c = customer(h, d.customerId)!;
  const sendInvoice = () => {
    const undo = store.commit("Send invoice", (draft) => void (draft.drafts.find((x) => x.id === d.id)!.status = "invoice_sent"));
    say(`Invoice for ${money(d.total)} emailed to ${c.email}.`, undo);
  };
  const markPaid = () => {
    const number = Math.max(...h.orders.map((o) => o.number)) + 1;
    const orderId = `ord_${Date.now().toString(36)}`;
    store.commit("Complete draft", (draft) => {
      const at = new Date().toISOString();
      draft.drafts.find((x) => x.id === d.id)!.status = "completed";
      draft.orders.push({ id: orderId, number, customerId: d.customerId, createdAt: at, promisedShipAt: promisedShip(at), items: d.items.map((it) => ({ ...it })), subtotal: d.subtotal, discountAmount: 0, shipping: d.shipping, tax: d.tax, total: d.total, paymentStatus: "paid", fulfillmentStatus: "unfulfilled", status: "open", source: "direct", refunds: [], tags: ["draft"], timeline: [{ id: `ev_${Date.now().toString(36)}a`, at, kind: "placed", text: `Order created from draft #D${d.number}` }, { id: `ev_${Date.now().toString(36)}b`, at, kind: "paid", text: `Payment of ${money(d.total)} marked as received` }], shippingAddress: { ...c.address }, billingSame: true, note: d.note });
      for (const it of d.items) for (const p of draft.products) for (const v of p.variants) if (v.id === it.variantId) v.inventory = Math.max(0, v.inventory - it.qty);
    });
    say(`Draft #D${d.number} became order #${number}.`);
    navigate(`/orders/${orderId}`);
  };
  const del = () => {
    store.commit("Delete draft", (draft) => void (draft.drafts = draft.drafts.filter((x) => x.id !== d.id)));
    say(`Draft #D${d.number} deleted.`);
    navigate("/orders/drafts");
  };
  return (
    <Page back={{ to: "/orders/drafts", label: "Drafts" }} title={`#D${d.number}`} titleMeta={<Badge tone={d.status === "completed" ? "success" : d.status === "invoice_sent" ? "info" : "neutral"}>{DRAFT_LABEL[d.status]}</Badge>} subtitle={`${dateOnly(d.createdAt)} · ${fullName(c)}`} secondary={d.status !== "completed" ? <><Button onClick={sendInvoice}>{d.status === "invoice_sent" ? "Resend invoice" : "Send invoice"}</Button><Button variant="tertiary" onClick={() => setRemove(true)}>Delete draft</Button></> : undefined} actions={d.status !== "completed" ? <Button variant="primary" onClick={markPaid}>Mark as paid</Button> : undefined}>
      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          <Card padded={false}>
            <CardSection title="Products">
              <Items items={d.items} qty={(it) => it.qty} />
            </CardSection>
            <CardSection title="Payment">
              <dl className="q-receipt">
                <dt>Subtotal</dt>
                <dd className="q-receipt-note">{plural(d.items.reduce((s, it) => s + it.qty, 0), "item")}</dd>
                <dd>{money(d.subtotal)}</dd>
                <dt>Shipping</dt>
                <dd className="q-receipt-note">{d.shipping === 0 ? "Free shipping" : "Standard"}</dd>
                <dd>{money(d.shipping)}</dd>
                <dt>Tax</dt>
                <dd className="q-receipt-note">{c.address.state}</dd>
                <dd>{money(d.tax)}</dd>
                <dt className="is-total">Total</dt>
                <dd className="is-total" />
                <dd className="is-total">{money(d.total)}</dd>
              </dl>
            </CardSection>
          </Card>
        </div>
        <div className="q-stack q-stack-loose">
          <Card title="Notes">{d.note ? <p>{d.note}</p> : <p className="q-muted">No notes</p>}</Card>
          <Card padded={false}>
            <CardSection title="Customer">
              <Link to={`/customers/${c.id}`} className="q-link">
                {fullName(c)}
              </Link>
            </CardSection>
            <CardSection title="Contact information">
              <a href={`mailto:${c.email}`} className="q-link">
                {c.email}
              </a>
            </CardSection>
            <CardSection title="Shipping address">
              <AddressLines a={c.address} />
            </CardSection>
          </Card>
        </div>
      </div>
      {remove && (
        <Modal title={`Delete draft #D${d.number}?`} onClose={() => setRemove(false)} tone="danger" secondary={<Button onClick={() => setRemove(false)}>Keep draft</Button>} primary={<Button variant="critical" onClick={del}>Delete draft</Button>}>
          <p>The draft and its invoice link stop working. Nothing is charged and no order is created. This can't be undone.</p>
        </Modal>
      )}
    </Page>
  );
}

/* ---- Abandoned checkouts ---- */

const EMAIL_LABEL = { not_sent: "Not sent", sent: "Sent", opened: "Opened", recovered: "Recovered" } as const;
export function Checkouts() {
  const { h, open } = useQuay();
  const rows = [...h.checkouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const value = rows.filter((c) => c.emailStatus !== "recovered").reduce((s, c) => s + c.subtotal, 0);
  return (
    <Page title="Abandoned checkouts" subtitle={`${plural(rows.length, "checkout")} in the last two weeks, ${money(value)} still in carts.`} back={{ to: "/orders", label: "Orders" }} fullWidth actions={<Button variant="primary" icon="spark" onClick={() => open("checkouts.recover")}>Send reminders</Button>}>
      <Card padded={false}>
        <IndexTable
          rows={rows}
          rowKey={(c) => c.id}
          caption="Abandoned checkouts"
          columns={[
            { key: "date", label: "Date", sort: (c) => c.createdAt, render: (c) => <span title={longDate(c.createdAt)}>{relative(c.createdAt)}</span> },
            { key: "customer", label: "Customer", render: (c) => (c.customerId ? <Link to={`/customers/${c.customerId}`} className="q-link">{c.name}</Link> : c.name) },
            { key: "email", label: "Email", render: (c) => <span className="q-muted">{c.email}</span>, secondary: true },
            { key: "status", label: "Email status", render: (c) => <Badge tone={c.emailStatus === "not_sent" ? "warning" : c.emailStatus === "recovered" ? "success" : c.emailStatus === "opened" ? "success" : "info"}>{EMAIL_LABEL[c.emailStatus]}</Badge> },
            { key: "recovery", label: "Recovery status", render: (c) => (c.emailStatus === "recovered" ? "Recovered" : c.remindedAt ? `Reminded ${relative(c.remindedAt)}${c.discountCode ? ` with ${c.discountCode}` : ""}` : "Not recovered"), secondary: true },
            { key: "items", label: "Cart", render: (c) => c.items.map((it) => it.title).join(", ") },
            { key: "total", label: "Total", align: "end", sort: (c) => c.subtotal, render: (c) => <span className="q-tabular">{money(c.subtotal)}</span> },
          ]}
          empty={<Empty icon="cart" title="No abandoned checkouts" body="A checkout lands here when someone enters their email and doesn't pay." />}
        />
      </Card>
    </Page>
  );
}
