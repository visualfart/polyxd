import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BIN_NAMES, type BinKind } from "../seed.ts";
import { useWexley } from "../session.ts";
import { BackLink, Breadcrumbs, Button, ErrorSummary, Heading, LinkButton, Radios, SummaryList, Tag, date, dayDate, money } from "../ui.tsx";

export function Bins() {
  const { w, open, store, say } = useWexley();
  const b = w.bins;
  const next = [
    { kind: "refuse" as const, when: b.refuse.next },
    { kind: "recycling" as const, when: b.recycling.next },
    ...(b.garden.subscribed ? [{ kind: "garden" as const, when: b.garden.next }] : []),
    { kind: "food" as const, when: b.refuse.next },
  ].sort((x, y) => x.when.localeCompare(y.when));
  const withdraw = (id: string) => {
    const undo = store.commit("Withdraw report", (d) => {
      d.bins.missed = d.bins.missed.filter((m) => m.id !== id);
    });
    say("Report withdrawn.", undo);
  };
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Bins" }]} />
      <div className="wx-grid">
        <div>
          <Heading caption={w.resident.address.line1}>Bins and collections</Heading>
          <table className="wx-table">
            <caption>Next collections</caption>
            <thead>
              <tr>
                <th scope="col">Bin</th>
                <th scope="col">Next collection</th>
                <th scope="col">Usually</th>
              </tr>
            </thead>
            <tbody>
              {next.map((n) => (
                <tr key={n.kind}>
                  <td>{BIN_NAMES[n.kind]}</td>
                  <td>{dayDate(n.when)}</td>
                  <td>{n.kind === "refuse" || n.kind === "food" ? `Every ${b.refuse.day}` : n.kind === "recycling" ? b.recycling.day : b.garden.day}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="wx-body">Put bins out by 6am on collection day, at the edge of your property.</p>
          <div className="wx-actions">
            <Button onClick={() => open("bin.missed")}>Report a missed collection</Button>
            <Button tone="secondary" to="/bins/request">
              Request a bin
            </Button>
          </div>

          {b.missed.length > 0 && (
            <section className="wx-section" aria-labelledby="missed">
              <h2 className="wx-h2" id="missed">
                Missed collections you reported
              </h2>
              <SummaryList rows={b.missed.map((m) => ({ key: BIN_NAMES[m.bin], value: <>{m.wasOut ? `We come back by ${dayDate(m.collectBy)}. ` : "Collected on the next normal day. "}<Tag tone={m.status === "open" ? "info" : "success"}>{m.status === "open" ? "Reported" : "Collected"}</Tag></>, action: m.status === "open" ? <LinkButton onClick={() => withdraw(m.id)}>Withdraw<span className="wx-sr-only"> the {BIN_NAMES[m.bin]} report</span></LinkButton> : undefined }))} />
            </section>
          )}
          {b.requests.length > 0 && (
            <section className="wx-section" aria-labelledby="requests">
              <h2 className="wx-h2" id="requests">
                Bins you asked for
              </h2>
              <SummaryList rows={b.requests.map((r) => ({ key: BIN_NAMES[r.bin], value: `${r.reason}. Asked for on ${date(r.at)}; delivered within 10 working days.` }))} />
            </section>
          )}

          <section className="wx-section" aria-labelledby="garden">
            <h2 className="wx-h2" id="garden">
              Garden waste
            </h2>
            {b.garden.subscribed ? (
              <p className="wx-body">
                Your green bin subscription runs until {date(b.garden.renewsOn)}. It costs {money(b.garden.price, { whole: true })} a year and is collected {b.garden.day.toLowerCase()}.
              </p>
            ) : (
              <p className="wx-body">You do not have a garden waste subscription. It costs {money(b.garden.price, { whole: true })} a year for a green bin collected every other week.</p>
            )}
          </section>
        </div>
        <aside>
          <h2 className="wx-h3">What goes where</h2>
          <ul className="wx-list wx-small">
            <li>Blue bin: paper, card, tins, plastic bottles and pots, glass</li>
            <li>Black bin: everything that cannot be recycled</li>
            <li>Food caddy: all food, cooked or raw</li>
            <li>Green bin: grass, leaves, small branches</li>
          </ul>
        </aside>
      </div>
    </>
  );
}

const REASONS = [
  { value: "My bin is damaged", label: "My bin is damaged" },
  { value: "My bin was lost or stolen", label: "My bin was lost or stolen" },
  { value: "I have moved in and there is no bin", label: "I have moved in and there is no bin" },
  { value: "My household needs a bigger bin", label: "My household needs a bigger bin", hint: "For 6 or more people, or a medical reason" },
];

export function RequestBin() {
  const { store, say } = useWexley();
  const navigate = useNavigate();
  const [bin, setBin] = useState<BinKind | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([]);
  const err = (id: string) => errors.find((e) => e.id === id)?.message;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = [];
    if (!bin) found.push({ id: "bin-refuse", message: "Select which bin you need" });
    if (!reason) found.push({ id: "reason-My bin is damaged", message: "Select why you need it" });
    setErrors(found);
    if (found.length) return;
    const undo = store.commit("Request bin", (d) => {
      d.bins.requests.unshift({ id: `req_${Date.now().toString(36)}`, bin: bin!, reason: reason!, at: new Date().toISOString(), status: "requested" });
    });
    say(`We have your request for a ${BIN_NAMES[bin!].toLowerCase()}. It is delivered within 10 working days.`, undo);
    navigate("/bins");
  };
  return (
    <>
      <BackLink to="/bins" />
      <div className="wx-grid">
        <div>
          <ErrorSummary errors={errors} />
          <form onSubmit={submit} noValidate>
            <Heading caption="Bins">Request a bin</Heading>
            <Radios id="bin" legend="Which bin do you need?" options={(["refuse", "recycling", "food", "garden"] as BinKind[]).map((k) => ({ value: k, label: BIN_NAMES[k] }))} value={bin} onChange={setBin} error={err("bin-refuse")} />
            <Radios id="reason" legend="Why do you need it?" options={REASONS} value={reason} onChange={setReason} error={err("reason-My bin is damaged")} />
            <p className="wx-body">A replacement bin is free. A bigger bin needs a short check first, and we call you about it.</p>
            <Button type="submit">Request bin</Button>
          </form>
        </div>
      </div>
    </>
  );
}
