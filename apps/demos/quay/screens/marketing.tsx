import { daysAgo, ordersBetween, type Source } from "../seed.ts";
import { useQuay } from "../session.ts";
import { Badge, Button, Card, Empty, IndexTable, Page, dayRangeText, money, plural, shortDate } from "./shared.tsx";

const SOURCE_LABEL: Record<Source, string> = { ads: "Paid ads", organic: "Organic search", email: "Email", social: "Social", direct: "Direct" };

export function Marketing() {
  const { h, store, say, open } = useQuay();
  const orders = ordersBetween(h, daysAgo(29), daysAgo(0));
  const total = orders.reduce((s, o) => s + o.total, 0);
  const bySource = (["ads", "organic", "email", "social", "direct"] as Source[]).map((s) => ({ s, n: orders.filter((o) => o.source === s).length, sales: orders.filter((o) => o.source === s).reduce((t, o) => t + o.total, 0) }));
  const toggle = (id: string) => {
    const c = h.campaigns.find((x) => x.id === id)!;
    const on = c.status === "paused";
    const undo = store.commit(on ? "Resume campaign" : "Pause campaign", (d) => {
      const dc = d.campaigns.find((x) => x.id === id)!;
      dc.status = on ? "active" : "paused";
      if (!on) dc.pauses.push({ from: daysAgo(0), to: daysAgo(0) });
      else {
        const p = dc.pauses.at(-1);
        if (p && p.from === daysAgo(0)) dc.pauses.pop();
      }
    });
    say(on ? `${c.name} is running again at ${money(c.dailyBudget)} a day.` : `${c.name} paused. No spend until you resume it.`, undo);
  };
  return (
    <Page title="Marketing" subtitle="Campaigns and where the last 30 days of sales came from." actions={<Button icon="spark" onClick={() => open("revenue.dip")}>Why did sales drop last week?</Button>}>
      <div className="q-grid q-grid-main">
        <Card title="Campaigns" padded={false}>
          <IndexTable
            rows={h.campaigns}
            rowKey={(c) => c.id}
            caption="Campaigns"
            columns={[
              { key: "name", label: "Campaign", render: (c) => (
                  <span>
                    <span className="q-strong">{c.name}</span>
                    <span className="q-cell-sub">
                      {c.channel} · since {shortDate(c.startedAt)}
                      {c.pauses.length ? ` · paused ${c.pauses.map((p) => dayRangeText(p.from, p.to)).join(", ")}` : ""}
                    </span>
                  </span>
                ) },
              { key: "status", label: "Status", render: (c) => <Badge tone={c.status === "active" ? "success" : "warning"}>{c.status === "active" ? "Active" : "Paused"}</Badge> },
              { key: "budget", label: "Daily budget", align: "end", render: (c) => <span className="q-tabular">{money(c.dailyBudget)}</span> },
              { key: "action", label: "", render: (c) => (
                  <Button size="slim" icon={c.status === "active" ? "pause" : "play"} onClick={() => toggle(c.id)}>
                    {c.status === "active" ? "Pause" : "Resume"}
                  </Button>
                ) },
            ]}
            empty={<Empty icon="marketing" title="No campaigns" />}
          />
        </Card>
        <Card title="Sales by source, last 30 days">
          <div className="q-stack">
            {bySource.map(({ s, n, sales }) => (
              <div key={s} className="q-row q-between" style={{ flexWrap: "nowrap" }}>
                <span>{SOURCE_LABEL[s]}</span>
                <span className="q-row" style={{ gap: 10, flexWrap: "nowrap" }}>
                  <span className="q-bars" style={{ width: 80, height: 8, gridAutoFlow: "row", alignItems: "stretch" }} aria-hidden="true">
                    <span style={{ width: `${total ? (sales / total) * 100 : 0}%`, height: "100%", borderRadius: 4 }} />
                  </span>
                  <span className="q-tabular q-muted" style={{ width: 120, textAlign: "right" }}>
                    {money(sales)} · {plural(n, "order")}
                  </span>
                </span>
              </div>
            ))}
            <p className="q-small q-muted">Attributed by the last visit before checkout.</p>
          </div>
        </Card>
      </div>
    </Page>
  );
}
