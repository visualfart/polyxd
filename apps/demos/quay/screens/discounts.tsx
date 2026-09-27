import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AUDIENCE_LABEL, DISCOUNT_TYPE_LABEL, audienceOf, customer, discountState, discountSummary, discountUses, fullName, type Discount as DiscountT, type DiscountState } from "../seed.ts";
import { useQuay } from "../session.ts";
import { Badge, Button, Card, CardSection, Empty, IndexTable, Modal, Page, dateOnly, money, plural, shortDate } from "../ui.tsx";

const STATE_TONE: Record<DiscountState, "success" | "info" | "neutral"> = { active: "success", scheduled: "info", expired: "neutral", disabled: "neutral" };
const STATE_LABEL: Record<DiscountState, string> = { active: "Active", scheduled: "Scheduled", expired: "Expired", disabled: "Inactive" };

export function Discounts() {
  const { h, open } = useQuay();
  const rows = [...h.discounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Page title="Discounts" fullWidth actions={<Button variant="primary" icon="spark" onClick={() => open("discount.create")}>Create discount</Button>}>
      <Card padded={false}>
        <IndexTable
          rows={rows}
          rowKey={(d) => d.id}
          href={(d) => `/discounts/${d.id}`}
          caption="Discounts"
          columns={[
            { key: "title", label: "Title", sort: (d) => d.title, render: (d) => (
                <span>
                  <span className="q-strong">{d.title}</span>
                  <span className="q-cell-sub">{discountSummary(d)}</span>
                </span>
              ) },
            { key: "status", label: "Status", sort: (d) => discountState(d), render: (d) => <Badge tone={STATE_TONE[discountState(d)]}>{STATE_LABEL[discountState(d)]}</Badge> },
            { key: "method", label: "Method", render: (d) => (d.method === "code" ? "Code" : "Automatic"), secondary: true },
            { key: "type", label: "Type", render: (d) => DISCOUNT_TYPE_LABEL[d.type], secondary: true },
            { key: "used", label: "Used", align: "end", sort: (d) => discountUses(h, d).length, render: (d) => <span className="q-tabular">{d.method === "code" ? plural(discountUses(h, d).length, "time") : <span className="q-muted">–</span>}</span> },
            { key: "dates", label: "Dates", render: (d) => `${shortDate(d.startsAt)}${d.endsAt ? ` – ${shortDate(d.endsAt)}` : ""}`, secondary: true },
          ]}
          empty={<Empty icon="discounts" title="No discounts" body="Create one for a launch, a segment or a season." action={<Button size="slim" onClick={() => open("discount.create")}>Create discount</Button>} />}
        />
      </Card>
    </Page>
  );
}

export function Discount() {
  const { id } = useParams();
  const { h, store, say } = useQuay();
  const navigate = useNavigate();
  const [remove, setRemove] = useState(false);
  const d = h.discounts.find((x) => x.id === id);
  if (!d) return <Empty icon="discounts" title="That discount isn't here" action={<Button to="/discounts">All discounts</Button>} />;
  const uses = discountUses(h, d);
  const state = discountState(d);
  const revenue = uses.reduce((s, o) => s + o.total, 0);
  const saved = uses.reduce((s, o) => s + o.discountAmount, 0);
  const reach = audienceOf(h, d.audience).length;
  const toggle = () => {
    const undo = store.commit(d.enabled ? "Deactivate" : "Activate", (draft) => {
      const dd = draft.discounts.find((x) => x.id === d.id)!;
      dd.enabled = !dd.enabled;
    });
    say(d.enabled ? `${d.title} is inactive. Nobody can use it until you turn it back on.` : `${d.title} is active again.`, undo);
  };
  const del = () => {
    store.commit("Delete discount", (draft) => void (draft.discounts = draft.discounts.filter((x) => x.id !== d.id)));
    say(`${d.title} deleted.`);
    navigate("/discounts");
  };
  return (
    <Page back={{ to: "/discounts", label: "Discounts" }} title={d.title} titleMeta={<Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>} subtitle={`${d.method === "code" ? "Discount code" : "Automatic discount"} · ${DISCOUNT_TYPE_LABEL[d.type]}`} secondary={<><Button onClick={toggle}>{d.enabled ? "Deactivate" : "Activate"}</Button>{uses.length === 0 && <Button variant="tertiary" onClick={() => setRemove(true)}>Delete</Button>}</>}>
      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          <Card padded={false}>
            <CardSection title="Summary">
              <ul style={{ listStyle: "disc", paddingLeft: 18 }} className="q-stack">
                <li>{discountSummary(d).split(" · ")[0]}</li>
                <li>{d.minOrder ? `Minimum purchase of ${money(d.minOrder)}` : "No minimum purchase"}</li>
                <li>{AUDIENCE_LABEL[d.audience]}{d.audience !== "everyone" ? ` (${plural(reach, "customer")} today)` : ""}</li>
                <li>{d.usageLimit ? `Limited to ${d.usageLimit} uses` : "No usage limit"}</li>
                <li>
                  {state === "scheduled" ? `Starts ${dateOnly(d.startsAt)}` : `Active from ${dateOnly(d.startsAt)}`}
                  {d.endsAt ? ` until ${dateOnly(d.endsAt)}` : ", no end date"}
                </li>
              </ul>
            </CardSection>
            <CardSection title="Performance" subdued>
              <div className="q-stats" style={{ boxShadow: "none" }}>
                <div className="q-stat">
                  <span className="q-stat-label">Used</span>
                  <span className="q-stat-value">{d.method === "code" ? uses.length : "–"}</span>
                </div>
                <div className="q-stat">
                  <span className="q-stat-label">Sales with it</span>
                  <span className="q-stat-value">{money(revenue)}</span>
                </div>
                <div className="q-stat">
                  <span className="q-stat-label">Given away</span>
                  <span className="q-stat-value">{money(saved)}</span>
                </div>
              </div>
            </CardSection>
          </Card>
          {uses.length > 0 && (
            <Card title={`Orders that used ${d.title}`} padded={false}>
              <IndexTable
                rows={[...uses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12)}
                rowKey={(o) => o.id}
                href={(o) => `/orders/${o.id}`}
                caption={`Orders that used ${d.title}`}
                columns={[
                  { key: "number", label: "Order", render: (o) => <span className="q-strong">#{o.number}</span> },
                  { key: "date", label: "Date", render: (o) => shortDate(o.createdAt) },
                  { key: "customer", label: "Customer", render: (o) => { const c = customer(h, o.customerId); return c ? <Link to={`/customers/${c.id}`} className="q-link">{fullName(c)}</Link> : "Guest"; } },
                  { key: "discount", label: "Discount", align: "end", render: (o) => <span className="q-tabular">-{money(o.discountAmount)}</span> },
                  { key: "total", label: "Total", align: "end", render: (o) => <span className="q-tabular">{money(o.total)}</span> },
                ]}
                empty={<Empty icon="orders" title="Not used yet" />}
              />
            </Card>
          )}
        </div>
        <div className="q-stack q-stack-loose">
          <Card title="Method">
            {d.code ? (
              <div className="q-stack" style={{ gap: 4 }}>
                <span className="q-mono" style={{ fontSize: 14 }}>{d.code}</span>
                <span className="q-muted">Customers enter this at checkout.</span>
              </div>
            ) : (
              <span className="q-muted">Applied automatically to every eligible cart.</span>
            )}
          </Card>
          <Card title="Combinations">
            <p className="q-muted">Can't combine with other discounts. Free shipping still applies over {money(40)}.</p>
          </Card>
        </div>
      </div>
      {remove && (
        <Modal title={`Delete ${d.title}?`} onClose={() => setRemove(false)} tone="danger" secondary={<Button onClick={() => setRemove(false)}>Keep it</Button>} primary={<Button variant="critical" onClick={del}>Delete discount</Button>}>
          <p>The discount is removed from the store. It hasn't been used on any order, so nothing else changes. This can't be undone.</p>
        </Modal>
      )}
    </Page>
  );
}

export type { DiscountT };
