import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TYPE_LABEL, daily, daysAgo, ordersBetween, product, summarize, type Source } from "../seed.ts";
import { useQuay } from "../session.ts";
import { Card, IndexTable, LineChart, Page, Select, Stat, Thumb, compact, dayRangeText, money, percent, plural, shortDate } from "./shared.tsx";
import { fromDay } from "../format.ts";

const RANGES: Record<string, { label: string; days: number }> = { today: { label: "Today", days: 1 }, "7": { label: "Last 7 days", days: 7 }, "30": { label: "Last 30 days", days: 30 }, "90": { label: "Last 90 days", days: 90 } };
const SOURCE_LABEL: Record<Source, string> = { ads: "Paid ads", organic: "Organic search", email: "Email", social: "Social", direct: "Direct" };

export function Analytics() {
  const { h } = useQuay();
  const [params, setParams] = useSearchParams();
  const range = params.get("range") && RANGES[params.get("range")!] ? params.get("range")! : "30";
  const days = RANGES[range].days;
  const from = daysAgo(days - 1);
  const to = daysAgo(0);
  const prevFrom = daysAgo(days * 2 - 1);
  const prevTo = daysAgo(days);
  const cur = summarize(h, from, to);
  const prev = summarize(h, prevFrom, prevTo);
  const change = (a: number, b: number) => (b ? (a - b) / b : a ? 1 : 0);
  const series = useMemo(() => daily(h, from, to), [h, from, to]);
  const prevSeries = useMemo(() => daily(h, prevFrom, prevTo), [h, prevFrom, prevTo]);
  const orders = ordersBetween(h, from, to);

  const top = useMemo(() => {
    const byProduct = new Map<string, { units: number; sales: number }>();
    for (const o of orders) for (const it of o.items) {
      const cur = byProduct.get(it.productId) ?? { units: 0, sales: 0 };
      cur.units += it.qty;
      cur.sales += it.qty * it.price;
      byProduct.set(it.productId, cur);
    }
    return [...byProduct.entries()]
      .map(([id, v]) => ({ id, p: product(h, id)!, ...v }))
      .filter((x) => x.p)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8);
  }, [orders, h]);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) for (const it of o.items) {
      const t = product(h, it.productId)?.type ?? "accessory";
      m.set(t, (m.get(t) ?? 0) + it.qty * it.price);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders, h]);
  const bySource = (["ads", "organic", "email", "social", "direct"] as Source[]).map((s) => ({ s, sales: orders.filter((o) => o.source === s).reduce((t, o) => t + o.total, 0) })).sort((a, b) => b.sales - a.sales);
  const gross = orders.reduce((s, o) => s + o.subtotal, 0);
  const discounts = orders.reduce((s, o) => s + o.discountAmount, 0);
  const shipping = orders.reduce((s, o) => s + o.shipping, 0);
  const taxes = orders.reduce((s, o) => s + o.tax, 0);
  const returns = orders.reduce((s, o) => s + o.refunds.reduce((t, r) => t + r.amount, 0), 0);

  return (
    <Page title="Analytics" subtitle={`${dayRangeText(from, to)} compared to ${dayRangeText(prevFrom, prevTo)}.`} fullWidth actions={<Select label="Date range" value={range} onChange={(v) => setParams({ range: v })} options={Object.entries(RANGES).map(([value, r]) => ({ value, label: r.label }))} />}>
      <div className="q-stats">
        <Stat label="Total sales" value={money(cur.sales)} change={change(cur.sales, prev.sales)} />
        <Stat label="Total orders" value={cur.orders} change={change(cur.orders, prev.orders)} />
        <Stat label="Sessions" value={cur.sessions.toLocaleString("en-US")} change={change(cur.sessions, prev.sessions)} />
        <Stat label="Conversion rate" value={percent(cur.conversion, 2)} change={change(cur.conversion, prev.conversion)} />
        <Stat label="Average order value" value={money(cur.aov)} change={change(cur.aov, prev.aov)} />
        <Stat label="Returning customer rate" value={percent(cur.returningRate, 1)} change={change(cur.returningRate, prev.returningRate)} />
      </div>
      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          <Card title="Total sales over time">
            <div className="q-stack">
              <LineChart points={series.map((d) => ({ x: shortDate(fromDay(d.date).toISOString()), y: d.revenue }))} compare={prevSeries.map((d) => d.revenue)} label={`Daily sales ${dayRangeText(from, to)}, ${money(cur.sales)} in total, against ${money(prev.sales)} the period before`} format={(n) => compact(n)} />
              <div className="q-legend">
                <span>{dayRangeText(from, to)}</span>
                <span className="is-compare">{dayRangeText(prevFrom, prevTo)}</span>
              </div>
            </div>
          </Card>
          <Card title="Top products by sales" padded={false}>
            <IndexTable
              rows={top}
              rowKey={(r) => r.id}
              href={(r) => `/products/${r.id}`}
              caption="Top products"
              columns={[
                { key: "product", label: "Product", render: (r) => (
                    <span className="q-entity">
                      <Thumb media={r.p.media[0]} size={32} />
                      <span className="q-entity-text">
                        <span className="q-entity-name">{r.p.title}</span>
                        <span className="q-entity-sub">{TYPE_LABEL[r.p.type]}</span>
                      </span>
                    </span>
                  ) },
                { key: "units", label: "Units", align: "end", sort: (r) => r.units, render: (r) => <span className="q-tabular">{r.units}</span> },
                { key: "sales", label: "Sales", align: "end", sort: (r) => r.sales, render: (r) => <span className="q-tabular">{money(r.sales)}</span> },
                { key: "share", label: "Share", align: "end", render: (r) => <span className="q-tabular q-muted">{percent(gross ? r.sales / gross : 0)}</span>, secondary: true },
              ]}
              empty={<p className="q-muted" style={{ padding: 16 }}>No sales in this range.</p>}
            />
          </Card>
        </div>
        <div className="q-stack q-stack-loose">
          <Card title="Sales breakdown">
            <dl className="q-receipt">
              <dt>Gross sales</dt>
              <dd className="q-receipt-note">{plural(cur.items, "item")}</dd>
              <dd>{money(gross)}</dd>
              <dt>Discounts</dt>
              <dd className="q-receipt-note" />
              <dd>-{money(discounts)}</dd>
              <dt>Returns</dt>
              <dd className="q-receipt-note" />
              <dd>-{money(returns)}</dd>
              <dt>Shipping</dt>
              <dd className="q-receipt-note" />
              <dd>{money(shipping)}</dd>
              <dt>Taxes</dt>
              <dd className="q-receipt-note" />
              <dd>{money(taxes)}</dd>
              <dt className="is-total">Net sales</dt>
              <dd className="is-total" />
              <dd className="is-total">{money(cur.net)}</dd>
            </dl>
          </Card>
          <Card title="Sales by product type">
            <div className="q-stack">
              {byType.map(([t, sales]) => (
                <div key={t} className="q-row q-between" style={{ flexWrap: "nowrap" }}>
                  <Link to={`/products?type=${t}`} className="q-link">
                    {TYPE_LABEL[t as keyof typeof TYPE_LABEL]}s
                  </Link>
                  <span className="q-tabular">{money(sales)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Sales by traffic source">
            <div className="q-stack">
              {bySource.map(({ s, sales }) => (
                <div key={s} className="q-row q-between" style={{ flexWrap: "nowrap" }}>
                  <span>{SOURCE_LABEL[s]}</span>
                  <span className="q-tabular">{money(sales)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
