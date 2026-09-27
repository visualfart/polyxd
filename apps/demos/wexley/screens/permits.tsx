import { useNavigate } from "react-router-dom";
import { daysUntil, oneLine, openFine, vehicleLine, zoneName } from "../seed.ts";
import { useWexley } from "../session.ts";
import { REASONS } from "../views.ts";
import { BackLink, Breadcrumbs, Button, Heading, LinkButton, SummaryList, Tag, Warning, date, dayDate, longDate, money } from "../ui.tsx";

export function Permits() {
  const { w, open } = useWexley();
  const p = w.permit;
  const days = daysUntil(p.expiry);
  const fine = openFine(w);
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Parking permits" }]} />
      <div className="wx-grid">
        <div>
          <Heading caption="Parking">Your parking permit</Heading>
          {days <= 60 && days > 0 && (
            <Warning>
              Your permit ends in {days} days, on {date(p.expiry)}. Renew it before then to keep parking near home without a break.
            </Warning>
          )}
          {days <= 0 && <Warning>Your permit has ended. Renew it before you park in the zone again.</Warning>}
          <SummaryList
            rows={[
              { key: "Status", value: <Tag tone={days <= 0 ? "danger" : days <= 60 ? "warning" : "success"}>{days <= 0 ? "Ended" : days <= 60 ? "Ends soon" : "Active"}</Tag> },
              { key: "Zone", value: zoneName(w, p.zone) },
              { key: "Vehicle", value: vehicleLine(p) },
              { key: "Address", value: oneLine(p.address), action: <LinkButton onClick={() => open("permit.address-change")}>Change<span className="wx-sr-only"> address</span></LinkButton> },
              { key: "Runs from", value: date(p.start) },
              { key: "Ends", value: date(p.expiry), action: <LinkButton onClick={() => open("permit.renew")}>Renew<span className="wx-sr-only"> permit</span></LinkButton> },
              { key: "Price for the year", value: money(p.price, { whole: true }) },
            ]}
          />
          <div className="wx-actions">
            <Button onClick={() => open("permit.renew")}>Renew permit</Button>
            <Button tone="secondary" onClick={() => open("permit.address-change")}>
              Update the address
            </Button>
          </div>

          {fine && (
            <section className="wx-section" aria-labelledby="fines">
              <h2 className="wx-h2" id="fines">
                Penalty charge notices
              </h2>
              <SummaryList
                rows={[
                  { key: "Notice number", value: fine.number },
                  { key: "Status", value: <Tag tone={fine.status === "issued" ? "danger" : fine.status === "appealed" ? "info" : fine.status === "paid" ? "success" : "neutral"}>{fine.status === "issued" ? "To pay" : fine.status === "appealed" ? "Appeal in progress" : fine.status === "paid" ? "Paid" : "Cancelled"}</Tag> },
                  { key: "Issued", value: longDate(fine.issued) },
                  { key: "Where", value: fine.location },
                  { key: "Reason given", value: fine.contravention },
                  { key: "Charge", value: fine.status === "issued" ? `${money(fine.amount)}, or ${money(fine.discountAmount)} if you pay by ${dayDate(fine.discountUntil)}` : money(fine.amount) },
                  ...(fine.appeal ? [{ key: "Your appeal", value: `${REASONS[fine.appeal.reason]}. Sent ${date(fine.appeal.sentAt)}; decision by ${date(fine.appeal.decideBy)}.` }] : []),
                ]}
              />
              {fine.status === "issued" && (
                <div className="wx-actions">
                  <Button to="/permits/fine/pay">Pay {money(fine.discountAmount)}</Button>
                  <Button tone="secondary" onClick={() => open("fine.appeal")}>
                    Appeal this notice
                  </Button>
                </div>
              )}
              {fine.status === "appealed" && <p className="wx-body">The fine is paused while we look at your appeal. If we refuse it, you have 14 days from then to pay at the lower amount.</p>}
            </section>
          )}

          <section className="wx-section" aria-labelledby="history">
            <h2 className="wx-h2" id="history">
              History
            </h2>
            <ul className="wx-list">
              {[...p.history].reverse().map((h) => (
                <li key={h.at + h.what}>
                  {date(h.at)}: {h.what}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside>
          <h2 className="wx-h3">Zones and prices</h2>
          <ul className="wx-list wx-small">
            {w.zones.map((z) => (
              <li key={z.id}>
                Zone {z.id}, {z.name}: {money(z.price, { whole: true })} a year
              </li>
            ))}
          </ul>
          <p className="wx-small wx-muted">Your zone comes from your postcode. A permit covers one vehicle at one address.</p>
        </aside>
      </div>
    </>
  );
}

/** Paying the fine is the council's own page: a summary, one green button, a letter afterwards. */
export function PayFine() {
  const { w, store, say } = useWexley();
  const navigate = useNavigate();
  const fine = openFine(w);
  if (!fine || fine.status !== "issued") return <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Parking permits", to: "/permits" }, { label: "Nothing to pay" }]} />;
  const discount = Date.now() < new Date(fine.discountUntil).getTime();
  const amount = discount ? fine.discountAmount : fine.amount;
  const pay = () => {
    const undo = store.commit("Pay fine", (d) => {
      const f = d.fines.find((x) => x.id === fine.id)!;
      f.status = "paid";
      d.messages.unshift({ id: `msg_${Date.now().toString(36)}`, at: new Date().toISOString(), subject: `Receipt for notice ${fine.number}`, from: "Parking services", about: "/permits", read: false, body: [`We received ${money(amount)} for penalty charge notice ${fine.number}. The notice is now closed.`] });
    });
    say(`Paid ${money(amount)} for notice ${fine.number}. Your receipt is in your messages.`, undo);
    navigate("/permits");
  };
  return (
    <>
      <BackLink to="/permits" />
      <div className="wx-grid">
        <div>
          <Heading caption="Penalty charge notice">Pay {money(amount)}</Heading>
          <SummaryList
            rows={[
              { key: "Notice number", value: fine.number },
              { key: "Vehicle", value: w.permit.vehicle.registration },
              { key: "Where", value: fine.location },
              { key: "Amount", value: discount ? `${money(amount)} (reduced from ${money(fine.amount)} because you pay by ${dayDate(fine.discountUntil)})` : money(amount) },
              { key: "Card", value: "The card you renewed your permit with, ending 4471" },
            ]}
          />
          <p className="wx-body">Paying closes the notice. You cannot appeal it afterwards.</p>
          <div className="wx-actions">
            <Button onClick={pay}>Pay {money(amount)} now</Button>
            <Button tone="secondary" to="/permits">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
