import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { suggestions } from "../../kit/ask.ts";
import { ASKABLE } from "../intents.ts";
import { BIN_NAMES, SLOT_NAMES, STAGE_NAMES, daysUntil, nextPaymentDay, oneLine, openFine } from "../seed.ts";
import { useWexley } from "../session.ts";
import { BENEFIT_STATUS } from "../views.ts";
import { Button, Heading, LinkButton, ServiceRow, date, dayDate, money, shortDate } from "../ui.tsx";

export function Account() {
  const { w, ask, open } = useWexley();
  const fine = openFine(w);
  const repair = w.repairs.find((r) => r.stage < 3);
  const todo = w.benefit.evidence.filter((e) => e.status === "todo").length;
  const unread = w.messages.filter((m) => !m.read).length;
  const permitDays = daysUntil(w.permit.expiry);
  const nextBin = [w.bins.refuse.next, w.bins.recycling.next, ...(w.bins.garden.subscribed ? [w.bins.garden.next] : [])].sort()[0];
  const nextBinName = nextBin === w.bins.refuse.next ? "Refuse" : nextBin === w.bins.recycling.next ? "Recycling" : "Garden waste";
  const things: { title: string; body: string; action: () => void; label: string }[] = [];
  if (todo) things.push({ title: `Send ${todo} document${todo === 1 ? "" : "s"} for your housing benefit claim`, body: `By ${dayDate(w.benefit.deadline)}, or the claim may be refused.`, action: () => open("benefit.evidence"), label: "Send documents" });
  if (fine?.status === "issued") things.push({ title: `Pay or appeal a parking fine of ${money(fine.amount)}`, body: `${money(fine.discountAmount)} if you pay by ${dayDate(fine.discountUntil)}.`, action: () => open("fine.appeal"), label: "Appeal it" });
  if (permitDays <= 60) things.push({ title: `Your parking permit ends in ${permitDays} days`, body: `Renew it for ${money(w.permit.price, { whole: true })} so there is no gap.`, action: () => open("permit.renew"), label: "Renew permit" });
  if (repair?.appointment && repair.stage === 2) things.push({ title: `A repair visit on ${dayDate(repair.appointment.date)}`, body: `${SLOT_NAMES[repair.appointment.slot]}. Someone over 18 needs to be at home.`, action: () => open("repair.status"), label: "See the repair" });
  return (
    <>
      <Heading caption={oneLine(w.resident.address)}>{w.resident.name}</Heading>
      <div className="wx-grid">
        <div>
          <AskBox onAsk={ask} />
          {things.length > 0 && (
            <section className="wx-section" aria-labelledby="todo">
              <h2 className="wx-h2" id="todo">
                Things to do
              </h2>
              <ul className="wx-todo">
                {things.map((t) => (
                  <li key={t.title}>
                    <span className="wx-todo-title">{t.title}</span>
                    <p>
                      {t.body} <LinkButton onClick={t.action}>{t.label}</LinkButton>
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="wx-section" aria-labelledby="services">
            <h2 className="wx-h2" id="services">
              Your services
            </h2>
            <ul className="wx-services">
              <ServiceRow to="/permits" title="Parking permit" status={permitDays <= 60 ? "Ends soon" : "Active"} tone={permitDays <= 60 ? "warning" : "success"}>
                Zone {w.permit.zone} · {w.permit.vehicle.registration} · ends {date(w.permit.expiry)}
                {fine?.status === "issued" && " · 1 fine to pay"}
                {fine?.status === "appealed" && " · appeal in progress"}
              </ServiceRow>
              <ServiceRow to="/council-tax" title="Council tax" status="Up to date" tone="success">
                Band {w.councilTax.band} · next payment {money(w.councilTax.plan.monthly)} on {shortDate(nextPaymentDay(w.councilTax.plan.day))}
              </ServiceRow>
              <ServiceRow to={repair ? `/repairs/${repair.id}` : "/repairs"} title="Repairs" status={repair ? STAGE_NAMES[repair.stage] : "None open"} tone={repair ? "info" : "neutral"}>
                {repair ? `${repair.problem} · ${repair.appointment ? `visit ${dayDate(repair.appointment.date)}` : `reported ${date(repair.reported)}`}` : "Nothing being fixed at the moment"}
              </ServiceRow>
              <ServiceRow to="/bins" title="Bins" status={w.bins.missed.some((m) => m.status === "open") ? "Missed collection reported" : undefined} tone="info">
                Next: {nextBinName}, {dayDate(nextBin)} · {BIN_NAMES.refuse.split(" ")[0].toLowerCase()} every {w.bins.refuse.day}
              </ServiceRow>
              <ServiceRow to="/benefits" title="Housing benefit" status={BENEFIT_STATUS[w.benefit.status]} tone={w.benefit.status === "awaiting-evidence" ? "warning" : "info"}>
                Claim {w.benefit.reference} · sent {date(w.benefit.submitted)}
              </ServiceRow>
              <ServiceRow to="/messages" title="Messages" status={unread ? `${unread} unread` : undefined} tone="info">
                {w.messages[0] ? `Latest: ${w.messages[0].subject}` : "No letters yet"}
              </ServiceRow>
            </ul>
          </section>
        </div>
        <aside>
          <h2 className="wx-h3">Your details</h2>
          <p className="wx-body wx-small">
            {w.resident.email}
            <br />
            {w.resident.phone}
          </p>
          <p className="wx-body wx-small">
            <Link to="/settings">Change your details</Link>
          </p>
          <h2 className="wx-h3">Get help</h2>
          <p className="wx-body wx-small">Call 01632 960 100, Monday to Friday, 9am to 5pm. Calls cost the same as a local call.</p>
        </aside>
      </div>
    </>
  );
}

function AskBox({ onAsk }: { onAsk: (text: string) => void }) {
  const [text, setText] = useState("");
  const tries = useMemo(() => suggestions(ASKABLE, 3), []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onAsk(text.trim());
  };
  return (
    <section className="wx-ask" aria-labelledby="ask-title">
      <h2 id="ask-title">What do you need to do?</h2>
      <p>Ask in your own words. The council writes the page for it, and checks it before you see it.</p>
      <form className="wx-ask-form" onSubmit={submit} role="search">
        <label className="wx-sr-only" htmlFor="ask-home">
          What do you need to do?
        </label>
        <input id="ask-home" className="wx-input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" enterKeyHint="go" placeholder="For example, renew my parking permit" />
        <Button type="submit">Continue</Button>
      </form>
      <div className="wx-ask-tries">
        {tries.map((t) => (
          <LinkButton key={t} onClick={() => onAsk(t)}>
            {t}
          </LinkButton>
        ))}
      </div>
    </section>
  );
}
