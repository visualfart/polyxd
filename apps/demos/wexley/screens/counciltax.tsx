import { nextPaymentDay } from "../seed.ts";
import { useWexley } from "../session.ts";
import { METHODS } from "../views.ts";
import { Breadcrumbs, Button, Heading, LinkButton, SummaryList, date, money } from "../ui.tsx";
import { ordinal } from "../format.ts";

export function CouncilTax() {
  const { w, open } = useWexley();
  const t = w.councilTax;
  const remaining = Math.round((t.annual - t.paid) * 100) / 100;
  const pct = Math.round((t.paid / t.annual) * 100);
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Council tax" }]} />
      <div className="wx-grid">
        <div>
          <Heading caption={`Account ${t.account}`}>Council tax</Heading>
          <SummaryList
            rows={[
              { key: "Property", value: `${w.resident.address.line1}, ${w.resident.address.postcode}` },
              { key: "Band", value: t.band },
              { key: "Charge for the year", value: money(t.annual) },
              { key: "Paid so far", value: `${money(t.paid)} (${pct}%)` },
              { key: "Still to pay", value: money(remaining) },
              { key: "How you pay", value: `${t.plan.count} instalments of ${money(t.plan.monthly)} by ${METHODS[t.plan.method]} on the ${ordinal(t.plan.day)}`, action: <LinkButton onClick={() => open("counciltax.instalments")}>Change<span className="wx-sr-only"> how you pay</span></LinkButton> },
              { key: "Next payment", value: `${money(Math.min(t.plan.monthly, remaining))} on ${date(nextPaymentDay(t.plan.day))}` },
            ]}
          />
          <div className="wx-actions">
            <Button onClick={() => open("counciltax.instalments")}>Change how you pay</Button>
          </div>
          <section className="wx-section" aria-labelledby="statements">
            <h2 className="wx-h2" id="statements">
              Bills and payments
            </h2>
            <table className="wx-table">
              <caption className="wx-sr-only">Bills and payments this year</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">What</th>
                  <th scope="col" className="wx-num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.statements.map((s) => (
                  <tr key={s.id}>
                    <td>{date(s.date)}</td>
                    <td>{s.description}</td>
                    <td className="wx-num">{s.amount === 0 ? "—" : s.amount < 0 ? `−${money(s.amount)}` : money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
        <aside>
          <h2 className="wx-h3">About band {t.band}</h2>
          <p className="wx-body wx-small">Your band comes from what your home was worth in 1991. If you think it is wrong, you can ask for it to be checked.</p>
          <h2 className="wx-h3">Help paying</h2>
          <p className="wx-body wx-small">If you live alone you can get 25% off. If you are on a low income you may get council tax support.</p>
        </aside>
      </div>
    </>
  );
}
