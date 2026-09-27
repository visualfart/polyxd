import { useNavigate, useParams } from "react-router-dom";
import { useHalden } from "../session.ts";
import { Amount, Avatar, Button, Card, Empty, ListItem, SectionTitle, TopBar, dayLabel, longDate, money, shortDate } from "../ui.tsx";
import { PaymentItem } from "./payments.tsx";

export function Payees() {
  const { h, open } = useHalden();
  const withHistory = h.payees.map((p) => {
    const paid = h.payments.filter((x) => x.payeeId === p.id);
    return { ...p, last: paid.at(-1), count: paid.length };
  });
  const recent = withHistory.filter((p) => p.last).sort((a, b) => b.last!.at.localeCompare(a.last!.at));
  const rest = withHistory.filter((p) => !p.last).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <TopBar
        title="Payees"
        trailing={
          <Button tone="text" icon="add" onClick={() => open("payee.add")}>
            Add
          </Button>
        }
      />
      {h.payees.length === 0 ? (
        <Empty icon="people" title="No payees yet" body="Add someone once and sending money takes ten seconds after that." action={<Button tone="filled" onClick={() => open("payee.add")}>Add a payee</Button>} />
      ) : (
        <>
          {recent.length > 0 && <SectionTitle>Recent</SectionTitle>}
          <ul className="hal-list">
            {recent.map((p) => (
              <li key={p.id}>
                <ListItem to={`/payees/${p.id}`} leading={<Avatar name={p.name} />} title={p.name} supporting={`Last paid ${dayLabel(p.last!.at).toLowerCase()} · ${p.count} payment${p.count === 1 ? "" : "s"}`} trailing={<Amount value={p.last!.amount} />} />
              </li>
            ))}
          </ul>
          {rest.length > 0 && <SectionTitle>Others</SectionTitle>}
          <ul className="hal-list">
            {rest.map((p) => (
              <li key={p.id}>
                <ListItem to={`/payees/${p.id}`} leading={<Avatar name={p.name} />} title={p.name} supporting={`Added ${shortDate(p.addedAt)}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function Payee() {
  const { id } = useParams();
  const { h, open, store, say } = useHalden();
  const navigate = useNavigate();
  const p = h.payees.find((x) => x.id === id);
  if (!p) return <Empty icon="people" title="That payee isn't here" action={<Button to="/payees">All payees</Button>} />;
  const history = h.payments.filter((x) => x.payeeId === p.id).reverse();
  const sent = history.filter((x) => x.amount < 0).reduce((s, x) => s - x.amount, 0);
  const remove = () => {
    const undo = store.commit(`Remove ${p.name}`, (d) => {
      d.payees = d.payees.filter((x) => x.id !== p.id);
    });
    say(`Removed ${p.name}.`, undo);
    navigate("/payees");
  };
  return (
    <>
      <TopBar title="Payee" back="/payees" hidden />
      <div className="hal-hero">
        <Avatar name={p.name} size={72} />
        <span className="hal-hero-title">{p.name}</span>
        <p>
          {p.kind === "business" ? "Business" : "Person"} · added {longDate(p.addedAt)}
        </p>
      </div>
      <div className="hal-actions" style={{ justifyContent: "center" }}>
        <Button tone="filled" icon="send" onClick={() => open("money.send", { payee: p.id })}>
          Send money
        </Button>
        <Button tone="outlined" onClick={remove}>
          Remove
        </Button>
      </div>
      <Card tone="outlined">
        <dl className="hal-details">
          <dt>Sort code</dt>
          <dd>{p.sortCode}</dd>
          <dt>Account number</dt>
          <dd>{p.accountNumber}</dd>
          {p.reference && (
            <>
              <dt>Reference</dt>
              <dd>{p.reference}</dd>
            </>
          )}
          <dt>Sent in total</dt>
          <dd>{money(sent)}</dd>
        </dl>
      </Card>
      {history.length > 0 && (
        <>
          <SectionTitle>With {p.name.split(" ")[0]}</SectionTitle>
          <ul className="hal-list">
            {history.map((x) => (
              <PaymentItem key={x.id} p={x} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
