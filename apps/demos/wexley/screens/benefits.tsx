import { useWexley } from "../session.ts";
import { BENEFIT_STATUS } from "../views.ts";
import { Breadcrumbs, Button, Heading, SummaryList, Tag, Warning, date, dayDate, money } from "../ui.tsx";

export function Benefits() {
  const { w, open } = useWexley();
  const c = w.benefit;
  const todo = c.evidence.filter((e) => e.status === "todo");
  return (
    <>
      <Breadcrumbs items={[{ label: "Your account", to: "/" }, { label: "Benefits" }]} />
      <div className="wx-grid">
        <div>
          <Heading caption={`Claim ${c.reference}`}>{c.type}</Heading>
          {todo.length > 0 && (
            <Warning>
              Send {todo.length === 1 ? "the missing document" : `the ${todo.length} missing documents`} by {dayDate(c.deadline)}. If we do not get them, we decide your claim on what we have, and it may be refused.
            </Warning>
          )}
          <SummaryList
            rows={[
              { key: "Status", value: <Tag tone={c.status === "awaiting-evidence" ? "warning" : c.status === "assessing" ? "info" : "success"}>{BENEFIT_STATUS[c.status]}</Tag> },
              { key: "Sent", value: date(c.submitted) },
              { key: "What you may get", value: `About ${money(c.weeklyEstimate)} a week, once we have checked your income` },
              { key: "Paid to", value: "Your rent account with Wexley Homes, every 4 weeks" },
            ]}
          />
          <section className="wx-section" aria-labelledby="evidence">
            <h2 className="wx-h2" id="evidence">
              What we need from you
            </h2>
            <ol className="wx-tracker" aria-label="Documents">
              {c.evidence.map((e) => (
                <li key={e.id}>
                  <span>
                    <span className="wx-tracker-title">{e.what}</span>
                    <br />
                    <span className="wx-small wx-muted">{e.status === "done" ? `${e.files.map((f) => f.name).join(", ")} · received ${date(e.receivedAt!)}` : e.why}</span>
                  </span>
                  <Tag tone={e.status === "done" ? "success" : "warning"}>{e.status === "done" ? "Received" : "Needed"}</Tag>
                </li>
              ))}
            </ol>
            <div className="wx-actions">
              <Button onClick={() => open("benefit.evidence")}>{todo.length ? "Send documents" : "See what we have"}</Button>
            </div>
          </section>
        </div>
        <aside>
          <h2 className="wx-h3">How long it takes</h2>
          <p className="wx-body wx-small">We decide most claims within 14 days of getting everything we need. If we need to ask you something, we write to you through this account.</p>
        </aside>
      </div>
    </>
  );
}
