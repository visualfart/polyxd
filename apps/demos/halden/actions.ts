import type { ActionEvent } from "@polyxd/react";
import { daysFromNow, type Store, type Undo } from "../kit/store.ts";
import { balance, category, payee, type Halden } from "./seed.ts";
import { money } from "./format.ts";

/**
 * What Halden does when a generated surface asks for a capability. Every action changes the data
 * for real (the screens after it show the change); reversible ones offer Undo; consequential ones
 * only arrive here from a confirmation, because the registry says so and the verifier checked.
 */
export interface Outcome {
  /** Text for the snackbar. */
  say?: string;
  undo?: Undo;
  /** Open another surface next (a review step, a confirmation) with these slots. */
  next?: { intent: string; slots?: Record<string, unknown> };
  /** Go to a screen of the product. */
  go?: string;
  /** Close the surface. */
  close?: boolean;
}

const arrivalTime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 2);
  return d.toISOString();
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function runAction(store: Store<Halden>, e: ActionEvent): Outcome {
  const h = store.get();
  const c = e.context as Record<string, any>;
  switch (e.name) {
    case "payment.open":
      return { go: `/payments/${c.id}`, close: true };
    case "payee.open":
      return { go: `/payees/${c.id}`, close: true };

    // The authored screens open an ask surface the way a button on a React screen did.
    case "budget.open":
      return { next: { intent: "budget.set", slots: c.category ? { category: String(c.category) } : {} } };
    case "card.ask":
      return { next: { intent: "card.freeze" } };
    case "subscriptions.open":
      return { next: { intent: "subscriptions.list" } };
    case "spend.category":
      return { next: { intent: "spend.category", slots: { category: String(c.category) } } };
    case "spend.compare":
      return { next: { intent: "spend.compare" } };
    case "card.setOnline": {
      const on = Boolean(c.on);
      const undo = store.commit(on ? "Online payments on" : "Online payments off", (d) => {
        d.card.onlinePayments = on;
      });
      return { say: on ? "Online payments on." : "Online payments off. The card won't work on websites or in apps.", undo };
    }

    case "transfer.review": {
      const p = payee(h, c.payeeId);
      const amount = Number(c.amount);
      if (!p || !(amount > 0)) return { say: "Choose a payee and an amount first." };
      const id = `q_${Date.now().toString(36)}`;
      store.commit("Quote", (d) => {
        d.quotes = [{ id, payeeId: p.id, amount, reference: String(c.reference ?? "").trim(), fee: 0, arrives: arrivalTime(), balanceAfter: Math.round((balance(d) - amount) * 100) / 100, madeAt: new Date().toISOString() }];
      });
      return { next: { intent: "money.send.confirm", slots: { payee: p.id, amount } } };
    }
    case "transfer.confirm": {
      const q = h.quotes.find((x) => x.id === c.quoteId) ?? h.quotes.at(-1);
      if (!q) return { say: "That payment needs reviewing again." };
      const p = payee(h, q.payeeId)!;
      store.commit(`Send ${money(q.amount)} to ${p.name}`, (d) => {
        d.payments.push({ id: `pay_${Date.now().toString(36)}`, at: new Date().toISOString(), amount: -q.amount, description: p.name, category: p.kind === "business" ? "bills" : "transfers", payeeId: p.id, reference: q.reference || undefined, card: false, status: "settled" });
        d.quotes = [];
      });
      return { say: `Sent ${money(q.amount)} to ${p.name.split(" ")[0]}. It arrives by ${fmtTime(q.arrives)}.`, close: true };
    }

    case "budget.setLimit": {
      const limit = Number(c.limit);
      const cat = category(h, String(c.category));
      if (!(limit > 0)) return { say: "Enter an amount for the budget." };
      const undo = store.commit(`Budget ${cat.name}`, (d) => {
        const b = d.budgets.find((x) => x.category === cat.id);
        if (b) {
          b.previousLimit = b.limit;
          b.limit = limit;
          b.setAt = new Date().toISOString();
        } else d.budgets.push({ category: cat.id, limit, previousLimit: null, setAt: new Date().toISOString() });
      });
      return { say: `${cat.name} budget set to ${money(limit, { whole: Number.isInteger(limit) })} a month.`, undo, close: true };
    }
    case "budget.restore": {
      const cat = category(h, String(c.category));
      store.commit(`Restore ${cat.name}`, (d) => {
        const b = d.budgets.find((x) => x.category === cat.id);
        if (b && b.previousLimit !== null) [b.limit, b.previousLimit] = [b.previousLimit, b.limit];
      });
      return { say: `${cat.name} budget put back.`, close: true };
    }

    case "dispute.review": {
      const p = h.payments.find((x) => x.id === c.paymentId);
      if (!p) return { say: "Choose the payment to report." };
      return { next: { intent: "payment.dispute.confirm", slots: { payment: p.id, reason: c.reason, note: String(c.note ?? "").trim() } } };
    }
    case "dispute.raise": {
      const p = h.payments.find((x) => x.id === c.paymentId);
      if (!p) return { say: "Choose the payment to report." };
      const id = `dsp_${Date.now().toString(36)}`;
      store.commit("Report payment", (d) => {
        const pay = d.payments.find((x) => x.id === p.id)!;
        pay.status = "refund-pending";
        pay.disputeId = id;
        d.disputes.push({ id, paymentId: p.id, reason: c.reason, note: c.note === "None" ? "" : String(c.note ?? ""), raisedAt: new Date().toISOString(), status: "open", decideBy: daysFromNow(15, 17) });
      });
      return { say: `Reported. ${money(-p.amount)} shows as pending refund; you'll hear within 15 days.`, close: true, go: `/payments/${p.id}` };
    }

    case "card.freeze": {
      const undo = store.commit("Freeze card", (d) => {
        d.card.frozen = true;
        d.card.frozenAt = new Date().toISOString();
      });
      return { say: "Card frozen. Nothing new goes through until you unfreeze it.", undo, close: true };
    }
    case "card.unfreeze": {
      const undo = store.commit("Unfreeze card", (d) => {
        d.card.frozen = false;
        d.card.frozenAt = null;
      });
      return { say: "Card unfrozen.", undo, close: true };
    }

    case "payee.create": {
      const name = String(c.name ?? "").trim();
      if (!name || !c.sortCode || !c.accountNumber) return { say: "Name, sort code and account number are needed." };
      const id = `p_${Date.now().toString(36)}`;
      const undo = store.commit(`Add ${name}`, (d) => {
        d.payees.push({ id, name, kind: /ltd|lettings|council|limited|plc|&/i.test(name) ? "business" : "person", sortCode: String(c.sortCode), accountNumber: String(c.accountNumber), reference: String(c.reference ?? ""), addedAt: new Date().toISOString() });
      });
      return { say: `Added ${name} as a payee.`, undo, close: true, go: `/payees/${id}` };
    }
    case "payee.delete": {
      const p = payee(h, c.id);
      if (!p) return {};
      const undo = store.commit(`Remove ${p.name}`, (d) => {
        d.payees = d.payees.filter((x) => x.id !== p.id);
      });
      return { say: `Removed ${p.name}.`, undo, close: true, go: "/payees" };
    }

    case "subscription.open": {
      const s = h.subscriptions.find((x) => x.id === c.id);
      if (!s) return {};
      if (!s.active) return { say: "That payment is already stopped." };
      return { next: { intent: "subscription.cancel.confirm", slots: { subscription: s.id } } };
    }
    case "subscription.cancel": {
      const s = h.subscriptions.find((x) => x.id === c.id);
      if (!s) return {};
      const m = h.merchants.find((x) => x.id === s.merchantId)!;
      const undo = store.commit(`Stop ${m.name}`, (d) => {
        d.subscriptions.find((x) => x.id === s.id)!.active = false;
      });
      return { say: `${m.name} stopped. The next ${money(s.amount)} won't go out.`, undo, close: true };
    }
    case "subscription.restore": {
      const s = h.subscriptions.find((x) => x.id === c.id);
      if (!s) return {};
      const undo = store.commit("Restore subscription", (d) => {
        d.subscriptions.find((x) => x.id === s.id)!.active = true;
      });
      return { say: "Subscription allowed again.", undo };
    }
    default:
      return { say: `Halden can't do "${e.name}" yet.` };
  }
}
