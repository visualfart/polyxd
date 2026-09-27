import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHalden } from "../session.ts";
import { Button } from "../ui.tsx";

const PAGES = [
  {
    title: "A current account that answers the question you asked",
    body: "Balance, payments, payees, budgets: the usual screens are here. For everything else, ask. Halden writes the screen you need, in its own design system.",
  },
  {
    title: "Ask in your own words",
    body: "“Send £40 to Priya for dinner.” “What did I spend on coffee this month?” “I was charged twice.” Each one becomes a screen, checked before you see it.",
  },
  {
    title: "Everything here stays here",
    body: "This is a demonstration built on Polyxd. The person, the payments and the money are made up, live in your browser, and can be put back to the start from Settings.",
  },
];

export function Welcome() {
  const { store } = useHalden();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const last = i === PAGES.length - 1;
  const done = () => {
    store.commit("Welcome", (d) => {
      d.settings.onboarded = true;
    });
    navigate("/", { replace: true });
  };
  return (
    <main className="hal-welcome">
      <span className="hal-welcome-mark" aria-hidden="true">
        h
      </span>
      <div className="hal-stack" style={{ gap: 12 }}>
        <h1>{PAGES[i].title}</h1>
        <p>{PAGES[i].body}</p>
      </div>
      <div className="hal-dots" aria-label={`Page ${i + 1} of ${PAGES.length}`} role="img">
        {PAGES.map((_, k) => (
          <span key={k} className={k === i ? "is-on" : undefined} />
        ))}
      </div>
      <div className="hal-actions">
        <Button tone="filled" onClick={last ? done : () => setI(i + 1)}>
          {last ? "Open Halden" : "Next"}
        </Button>
        {!last && (
          <Button tone="text" onClick={done}>
            Skip
          </Button>
        )}
      </div>
    </main>
  );
}
