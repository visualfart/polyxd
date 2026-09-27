import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { daysFromNow } from "../../kit/store.ts";
import { SLOT_NAMES, STAGE_NAMES, type Repair as RepairT } from "../seed.ts";
import { useWexley } from "../session.ts";
import { BackLink, Breadcrumbs, Button, ErrorSummary, Heading, Radios, SummaryList, Tag, TextField, date, dayDate, longDate, time } from "../ui.tsx";

const PRIORITY = { emergency: "Emergency: within 24 hours", urgent: "Urgent: within 5 working days", routine: "Routine: within 20 working days" };

export function Repairs() {
  const { w, open } = useWexley();
  const openOnes = w.repairs.filter((r) => r.stage < 3);
  const done = w.repairs.filter((r) => r.stage === 3);
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Repairs" }]} />
      <div className="wx-grid">
        <div>
          <Heading caption="Wexley Homes tenancy">Repairs</Heading>
          <p className="wx-body">Repairs to your home are done by Wexley Homes. Report a problem here and we tell you how quickly we fix it.</p>
          <div className="wx-actions">
            <Button to="/repairs/new">Report a repair</Button>
            {openOnes.length > 0 && (
              <Button tone="secondary" onClick={() => open("repair.status")}>
                Where is my repair?
              </Button>
            )}
          </div>
          <section className="wx-section" aria-labelledby="open">
            <h2 className="wx-h2" id="open">
              Being fixed
            </h2>
            {openOnes.length ? <RepairList repairs={openOnes} /> : <p className="wx-body">Nothing at the moment.</p>}
          </section>
          {done.length > 0 && (
            <section className="wx-section" aria-labelledby="done">
              <h2 className="wx-h2" id="done">
                Fixed
              </h2>
              <RepairList repairs={done} />
            </section>
          )}
        </div>
        <aside>
          <h2 className="wx-h3">Emergencies</h2>
          <p className="wx-body wx-small">No heating, no water, a serious leak or an unsafe electric: call 01632 960 200 at any time.</p>
        </aside>
      </div>
    </>
  );
}

function RepairList({ repairs }: { repairs: RepairT[] }) {
  return (
    <ul className="wx-services">
      {repairs.map((r) => (
        <li className="wx-service-row" key={r.id}>
          <div className="wx-service-head">
            <h3>
              <Link to={`/repairs/${r.id}`}>{r.problem}</Link>
            </h3>
            <Tag tone={r.stage === 3 ? "success" : "info"}>{STAGE_NAMES[r.stage]}</Tag>
          </div>
          <p className="wx-service-body">
            {r.reference} · reported {date(r.reported)}
            {r.appointment && r.stage < 3 && ` · visit ${dayDate(r.appointment.date)}, ${SLOT_NAMES[r.appointment.slot]}`}
            {r.fixedOn && ` · fixed ${date(r.fixedOn)}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Repair() {
  const { id } = useParams();
  const { w, store, say, open } = useWexley();
  const [params, setParams] = useSearchParams();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const noteRef = useRef<HTMLDivElement>(null);
  const r = w.repairs.find((x) => x.id === id);
  const wantsProblem = params.get("problem") === "1";
  useEffect(() => {
    if (wantsProblem) noteRef.current?.querySelector("textarea")?.focus();
  }, [wantsProblem]);
  if (!r)
    return (
      <>
        <BackLink to="/repairs" />
        <Heading>That repair is not here</Heading>
        <p className="wx-body">
          <Link to="/repairs">See all your repairs</Link>
        </p>
      </>
    );
  const sendNote = (e: FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 5) return setError("Tell us what has changed");
    setError(undefined);
    const undo = store.commit("Add note", (d) => {
      d.repairs.find((x) => x.id === r.id)!.notes.push({ at: new Date().toISOString(), text: note.trim(), from: "you" });
    });
    setNote("");
    setParams({});
    say("We have your note. The team sees it before the visit.", undo);
  };
  return (
    <>
      <BackLink to="/repairs" />
      <div className="wx-grid">
        <div>
          <Heading caption={r.reference}>{r.problem}</Heading>
          <ol className="wx-tracker" aria-label="Progress">
            {STAGE_NAMES.map((name, i) => (
              <li key={name} aria-current={i === r.stage && r.stage < 3 ? "step" : undefined}>
                <span className="wx-tracker-title">{name}</span>
                <Tag tone={r.stage === 3 || i < r.stage ? "success" : i === r.stage ? "info" : "neutral"}>{r.stage === 3 || i < r.stage ? "Completed" : i === r.stage ? "In progress" : "Not yet"}</Tag>
              </li>
            ))}
          </ol>
          <SummaryList
            rows={[
              { key: "Where", value: r.where },
              { key: "Reported", value: longDate(r.reported) },
              { key: "Priority", value: PRIORITY[r.priority] },
              ...(r.appointment ? [{ key: "Visit", value: `${dayDate(r.appointment.date)}, ${SLOT_NAMES[r.appointment.slot]}. ${r.appointment.who}.`, action: r.stage < 3 ? <button type="button" className="wx-link" onClick={() => open("appointment.rebook", { repair: r.id })}>Change<span className="wx-sr-only"> the visit</span></button> : undefined }] : []),
              ...(r.fixedOn ? [{ key: "Fixed", value: longDate(r.fixedOn) }] : []),
            ]}
          />
          {r.stage < 3 && (
            <div className="wx-actions">
              <Button onClick={() => open("repair.status", { repair: r.id })}>Where is my repair?</Button>
              {r.appointment && (
                <Button tone="secondary" onClick={() => open("appointment.rebook", { repair: r.id })}>
                  Rebook the visit
                </Button>
              )}
            </div>
          )}
          <section className="wx-section" aria-labelledby="notes">
            <h2 className="wx-h2" id="notes">
              Notes
            </h2>
            <ul className="wx-notes">
              {r.notes.map((n) => (
                <li key={n.at + n.text}>
                  <span className="wx-notes-meta">
                    {n.from === "you" ? "You" : "Wexley Homes"} · {date(n.at)} at {time(n.at)}
                  </span>
                  {n.text}
                </li>
              ))}
            </ul>
          </section>
          {r.stage < 3 && (
            <form onSubmit={sendNote} noValidate ref={noteRef as never}>
              <h2 className="wx-h2">Report a problem with this repair</h2>
              <TextField id="note" label="What has changed?" hint="For example, the leak is worse, or you will not be at home for the visit." multiline value={note} onChange={setNote} error={error} maxLength={500} />
              <Button type="submit">Send note</Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

const AREAS = [
  { value: "Kitchen", label: "Kitchen" },
  { value: "Bathroom", label: "Bathroom" },
  { value: "Living room or bedroom", label: "Living room or bedroom" },
  { value: "Heating or hot water", label: "Heating or hot water" },
  { value: "Outside", label: "Outside, doors or windows" },
];

/** The council's own report form: a few questions on one page, with the error summary GOV.UK uses. */
export function ReportRepair() {
  const { store, say } = useWexley();
  const navigate = useNavigate();
  const [where, setWhere] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [detail, setDetail] = useState("");
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([]);
  const err = (id: string) => errors.find((e) => e.id === id)?.message;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = [];
    if (!where) found.push({ id: "where-Kitchen", message: "Select where the problem is" });
    if (problem.trim().length < 4) found.push({ id: "problem", message: "Say what the problem is in a few words" });
    if (detail.trim().length < 20) found.push({ id: "detail", message: "Describe the problem in at least a sentence" });
    setErrors(found);
    if (found.length) return;
    const id = `rep_${Date.now().toString(36)}`;
    const reference = `REP ${String(4822 + store.get().repairs.length)}`;
    const undo = store.commit("Report repair", (d) => {
      d.repairs.unshift({ id, reference, problem: problem.trim(), where: where!, reported: new Date().toISOString(), stage: 0, priority: "routine", appointment: null, previousAppointment: null, fixedOn: null, notes: [{ at: new Date().toISOString(), text: detail.trim(), from: "you" }] });
      d.messages.unshift({ id: `msg_${Date.now().toString(36)}`, at: new Date().toISOString(), subject: `Repair ${reference}: we have your report`, from: "Wexley Homes", about: `/repairs/${id}`, read: false, body: [`Thank you for reporting: ${problem.trim()}.`, `We look at it within 2 working days and tell you when someone can visit. Routine repairs are done within 20 working days, by ${date(daysFromNow(28))}.`] });
    });
    say(`We have your report, reference ${reference}. We reply within 2 working days.`, undo);
    navigate(`/repairs/${id}`);
  };
  return (
    <>
      <BackLink to="/repairs" />
      <div className="wx-grid">
        <div>
          <ErrorSummary errors={errors} />
          <form onSubmit={submit} noValidate>
            <Heading caption="Repairs">Report a repair</Heading>
            <Radios id="where" legend="Where is the problem?" options={AREAS} value={where} onChange={setWhere} error={err("where-Kitchen")} />
            <TextField id="problem" label="What is the problem?" hint="A few words, like 'leaking kitchen tap'" value={problem} onChange={setProblem} error={err("problem")} maxLength={60} />
            <TextField id="detail" label="Tell us more" hint="How long it has been happening, and anything we need to know to get in." multiline value={detail} onChange={setDetail} error={err("detail")} maxLength={1000} />
            <Button type="submit">Send report</Button>
          </form>
        </div>
      </div>
    </>
  );
}
