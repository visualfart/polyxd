import type { ActionEvent } from "@polyxd/react";
import { daysFromNow, type Store, type Undo } from "../kit/store.ts";
import { BIN_NAMES, SLOT_NAMES, nextMarch, nextPaymentDay, nextWeekday, planMonthly, repair, zone, zoneForPostcode, type Address, type AppealReason, type BinKind, type Wexley } from "./seed.ts";
import { feeDifferenceFor, lastPaymentFrom, METHODS } from "./views.ts";
import { date, dayDate, money } from "./format.ts";

/**
 * What Wexley does when a generated surface asks for a capability. Every action changes the data
 * for real (the screens after it show the change); reversible ones offer Undo; anything sent to the
 * council only arrives here from a confirmation, because the registry says so and the verifier checked.
 */
export interface Outcome {
  /** Text for the notification banner. */
  say?: string;
  /** Banner heading; defaults to "Success" (or "Important" when nothing changed). */
  title?: string;
  undo?: Undo;
  /** Open another surface next (a review step, a confirmation) with these slots. */
  next?: { intent: string; slots?: Record<string, unknown>; replace?: boolean };
  /** Go to a screen of the product. */
  go?: string;
  /** Leave the surface: back to where it was opened from, or to `go`. */
  close?: boolean;
}

const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}`;
const ANSWER_STEP: Record<string, number> = { line1: 0, line2: 0, town: 0, postcode: 0, move_date: 1, vehicle: 2 };

export function runAction(store: Store<Wexley>, e: ActionEvent): Outcome {
  const w = store.get();
  const c = e.context as Record<string, any>;
  switch (e.name) {
    case "message.open":
      return { go: `/messages/${c.id}`, close: true };
    case "repair.open":
      return { go: `/repairs/${c.id}`, close: true };
    case "repair.problem":
      return { go: `/repairs/${c.repairId}?problem=1`, close: true };
    case "appointment.change":
      return { next: { intent: "appointment.rebook", slots: { repair: c.repairId } } };

    // The authored screens' ways in: each opens the page the ask box would have written.
    case "counciltax.instalments":
      return { next: { intent: "counciltax.instalments" } };
    case "bin.missed":
      return { next: { intent: "bin.missed", slots: c.bin ? { bin: c.bin } : {} } };
    case "bin.requestNew":
      return { go: "/bins/request" };
    case "benefit.evidence":
      return { next: { intent: "benefit.evidence" } };
    case "garden.change":
      return { next: { intent: c.subscribed ? "garden.cancel.confirm" : "garden.subscribe.confirm" } };
    case "garden.subscribe": {
      const price = w.bins.garden.price;
      const first = nextWeekday(3, 2);
      const until = nextMarch();
      store.commit("Subscribe to garden waste", (d) => {
        d.bins.garden = { ...d.bins.garden, subscribed: true, next: first, renewsOn: until };
        d.messages.unshift({ id: id("msg"), at: new Date().toISOString(), subject: "Your garden waste subscription", from: "Waste services", about: "/bins", read: false, body: [`Thank you. We have taken ${money(price, { whole: true })} and your green bin subscription runs until ${date(until)}.`, `Your green bin is delivered within 10 working days. The first collection is ${dayDate(first)}, then every other Wednesday.`, "You can cancel within 14 days for a full refund."] });
      });
      return { say: `We have taken ${money(price, { whole: true })}. Your green bin is delivered within 10 working days and the first collection is ${dayDate(first)}.`, close: true, go: "/bins" };
    }
    case "garden.cancel": {
      const g = w.bins.garden;
      if (!g.subscribed) return { say: "You do not have a garden waste subscription to cancel.", title: "Important" };
      store.commit("Cancel garden waste", (d) => {
        d.bins.garden.subscribed = false;
        d.messages.unshift({ id: id("msg"), at: new Date().toISOString(), subject: "Your garden waste subscription has ended", from: "Waste services", about: "/bins", read: false, body: [`We have cancelled your green bin subscription. We take the bin away on ${dayDate(g.next)}; leave it at the edge of your property.`, "There is no refund for the rest of the year. You can subscribe again at any time through your account."] });
      });
      return { say: `Your garden waste subscription has ended. We take the green bin away on ${dayDate(g.next)}.`, close: true, go: "/bins" };
    }

    case "answer.change": {
      // Back to the step that asked, with every answer kept.
      const { key, ...answers } = c;
      return { next: { intent: "permit.address-change", slots: { ...answers, step: ANSWER_STEP[key] ?? 0 }, replace: true } };
    }
    case "permit.review": {
      const address: Address = { line1: String(c.line1 ?? "").trim(), line2: String(c.line2 ?? "").trim(), town: String(c.town ?? "").trim(), postcode: String(c.postcode ?? "").trim().toUpperCase() };
      if (!address.line1 || !address.postcode || !c.moveDate) return { say: "Fill in the address and the date you move.", title: "There is a problem" };
      const z = zoneForPostcode(w, address.postcode);
      if (!z) return { say: `${address.postcode} is not in a Wexley permit zone. Permits cover WX1, WX2 and WX3. Check the postcode and try again.`, title: "There is a problem" };
      const changeId = id("chg");
      store.commit("Review address change", (d) => {
        d.drafts.permitChange = { id: changeId, address, moveDate: String(c.moveDate), vehicleUnchanged: c.vehicleUnchanged !== false, zone: z.id, feeDifference: feeDifferenceFor(d, z.id), madeAt: new Date().toISOString() };
      });
      return { next: { intent: "permit.address-change.confirm", slots: { ...c } } };
    }
    case "permit.update": {
      const change = w.drafts.permitChange;
      if (!change || change.id !== c.changeId) return { say: "That change needs reviewing again.", title: "There is a problem" };
      const moved = change.zone !== w.permit.zone;
      store.commit("Update permit address", (d) => {
        d.permit.address = change.address;
        d.permit.zone = change.zone;
        d.permit.price = zone(d, change.zone).price;
        d.permit.history.push({ at: new Date().toISOString(), what: `Address changed to ${change.address.line1}, ${change.address.postcode}${moved ? `; moved to zone ${change.zone}` : ""}` });
        d.resident.address = change.address;
        d.drafts.permitChange = null;
        d.messages.unshift({
          id: id("msg"),
          at: new Date().toISOString(),
          subject: "Your parking permit: new address confirmed",
          from: "Parking services",
          about: "/permits",
          read: false,
          body: [`From ${date(change.moveDate)} your permit covers zone ${change.zone} at ${change.address.line1}, ${change.address.postcode}.`, change.feeDifference > 0 ? `We have taken ${money(change.feeDifference)} for the rest of the year.` : change.feeDifference < 0 ? `We have refunded ${money(-change.feeDifference)} to your card.` : "There was nothing to pay.", "You can change it back within 14 days through your account."],
        });
      });
      return { say: `Your permit covers zone ${change.zone} at ${change.address.line1} from ${date(change.moveDate)}. We have sent you a letter to confirm.`, close: true, go: "/permits" };
    }
    case "permit.renew": {
      const p = w.permit;
      const price = zone(w, p.zone).price;
      const expiry = new Date(p.expiry);
      expiry.setFullYear(expiry.getFullYear() + 1);
      store.commit("Renew permit", (d) => {
        d.permit.expiry = expiry.toISOString();
        d.permit.price = price;
        d.permit.history.push({ at: new Date().toISOString(), what: `Renewed for a year, ${money(price)}` });
        d.messages.unshift({ id: id("msg"), at: new Date().toISOString(), subject: "Your parking permit has been renewed", from: "Parking services", about: "/permits", read: false, body: [`Thank you. We have taken ${money(price)} and your zone ${p.zone} permit for ${p.vehicle.registration} now runs until ${date(expiry.toISOString())}.`, "You can cancel within 14 days for a full refund."] });
      });
      return { say: `We have taken ${money(price)}. Your permit now runs until ${date(expiry.toISOString())}.`, close: true, go: "/permits" };
    }

    case "appeal.review": {
      const f = w.fines.find((x) => x.number === String(c.pcn ?? "").replace(/\s+/g, "").toUpperCase());
      if (!f) return { say: "We could not find a notice with that number. It is at the top of the notice, starting WX.", title: "There is a problem" };
      if (f.status !== "issued") return { say: "This notice has already been dealt with.", title: "There is a problem" };
      const draftId = id("apl");
      const evidence = Array.isArray(c.evidence) ? (c.evidence as { name: string; size: number }[]).map((x) => ({ name: x.name, size: x.size })) : [];
      store.commit("Review appeal", (d) => {
        d.drafts.appeal = { id: draftId, fineId: f.id, reason: c.reason as AppealReason, explanation: String(c.explanation ?? "").trim(), evidence, madeAt: new Date().toISOString() };
      });
      return { next: { intent: "fine.appeal.confirm", slots: { fine: f.id } } };
    }
    case "appeal.submit": {
      const draft = w.drafts.appeal;
      if (!draft || draft.id !== c.draftId) return { say: "That appeal needs checking again.", title: "There is a problem" };
      const decideBy = daysFromNow(14, 17);
      store.commit("Send appeal", (d) => {
        const f = d.fines.find((x) => x.id === draft.fineId)!;
        f.status = "appealed";
        f.appeal = { reason: draft.reason, explanation: draft.explanation, evidence: draft.evidence.length, sentAt: new Date().toISOString(), decideBy };
        d.drafts.appeal = null;
        d.messages.unshift({ id: id("msg"), at: new Date().toISOString(), subject: `We have your appeal for notice ${f.number}`, from: "Parking services", about: "/permits", read: false, body: ["Thank you. The fine is paused while we look at your appeal.", `You get our decision by ${date(decideBy)}. If we refuse the appeal, you have 14 days from then to pay at the lower amount.`] });
      });
      return { say: `We have your appeal. The fine is paused and you get a decision by ${date(decideBy)}.`, close: true, go: "/permits" };
    }

    case "appointment.rebook": {
      const r = repair(w, c.repairId);
      if (!r) return { say: "Choose the repair to rebook.", title: "There is a problem" };
      if (!c.date || !c.slot) return { say: "Pick a date and a time.", title: "There is a problem" };
      const when = new Date(`${c.date}T09:00:00`);
      if ([0, 6].includes(when.getDay())) return { say: "Visits are on weekdays. Pick a Monday to Friday.", title: "There is a problem" };
      const slot = c.slot === "pm" ? "pm" : "am";
      const undo = store.commit("Rebook visit", (d) => {
        const x = d.repairs.find((y) => y.id === r.id)!;
        x.previousAppointment = x.appointment;
        x.appointment = { date: when.toISOString(), slot, who: x.appointment?.who ?? "A plumber from Wexley Homes" };
        x.stage = Math.max(x.stage, 2) as 2 | 3;
        x.notes.push({ at: new Date().toISOString(), text: `Visit moved to ${dayDate(when.toISOString())}, ${SLOT_NAMES[slot]}.`, from: "us" });
      });
      return { say: `The visit is now ${dayDate(when.toISOString())}, ${SLOT_NAMES[slot]}. Someone over 18 needs to be at home.`, undo, close: true, go: `/repairs/${r.id}` };
    }
    case "appointment.restore": {
      const r = repair(w, c.repairId);
      if (!r?.previousAppointment) return {};
      const undo = store.commit("Restore visit", (d) => {
        const x = d.repairs.find((y) => y.id === r.id)!;
        x.appointment = x.previousAppointment;
        x.previousAppointment = null;
      });
      return { say: "The visit is back to the date it had before.", undo };
    }

    case "instalments.review": {
      const count = Number(c.count) === 12 ? 12 : 10;
      const day = [1, 15, 28].includes(Number(c.day)) ? (Number(c.day) as 1 | 15 | 28) : 1;
      const method = c.method === "card" ? "card" : "direct-debit";
      const planId = id("plan");
      const first = nextPaymentDay(day);
      store.commit("Review plan", (d) => {
        d.drafts.instalmentQuote = { id: planId, count, day, method, monthly: planMonthly(d, count), firstPayment: first, lastPayment: lastPaymentFrom(first, count), total: Math.round((d.councilTax.annual - d.councilTax.paid) * 100) / 100, madeAt: new Date().toISOString() };
      });
      return { next: { intent: "counciltax.instalments.confirm", slots: { count, day, method } } };
    }
    case "instalments.set": {
      const q = w.drafts.instalmentQuote;
      if (!q || q.id !== c.planId) return { say: "That plan needs reviewing again.", title: "There is a problem" };
      store.commit("Set instalments", (d) => {
        d.councilTax.plan = { count: q.count, day: q.day, method: q.method, monthly: q.monthly, firstPayment: q.firstPayment, setAt: new Date().toISOString() };
        d.councilTax.statements.unshift({ id: id("st"), date: new Date().toISOString(), description: `New bill: ${q.count} instalments of ${money(q.monthly)} by ${METHODS[q.method]}`, amount: 0 });
        d.drafts.instalmentQuote = null;
        d.messages.unshift({ id: id("msg"), at: new Date().toISOString(), subject: "Your new council tax bill", from: "Council tax", about: "/council-tax", read: false, body: [`You now pay ${money(q.monthly)} a month by ${METHODS[q.method]} on the ${q.day === 1 ? "1st" : `${q.day}th`}, from ${date(q.firstPayment)} to ${date(q.lastPayment)}.`, "Your bill shows every payment. You can change the plan again at any time."] });
      });
      return { say: `You now pay ${money(q.monthly)} a month, starting ${date(q.firstPayment)}. Your new bill is in your messages.`, close: true, go: "/council-tax" };
    }

    case "bin.reportMissed": {
      const bin = c.bin as BinKind;
      if (!BIN_NAMES[bin] || !c.date) return { say: "Choose the bin and the day it should have been collected.", title: "There is a problem" };
      const reportId = id("miss");
      const collectBy = daysFromNow(2, 18);
      const undo = store.commit("Report missed bin", (d) => {
        d.bins.missed.unshift({ id: reportId, bin, date: String(c.date), wasOut: c.wasOut !== false, reportedAt: new Date().toISOString(), collectBy, status: "open" });
      });
      return { say: c.wasOut === false ? `We have your report. The ${BIN_NAMES[bin].toLowerCase()} is collected on the next normal day.` : `We have your report. We come back for the ${BIN_NAMES[bin].toLowerCase()} by ${dayDate(collectBy)}. Leave it out.`, undo, close: true, go: "/bins" };
    }
    case "bin.missed.withdraw": {
      const report = w.bins.missed.find((m) => m.id === c.reportId);
      if (!report) return { say: "That report has already been withdrawn.", title: "Important" };
      if (report.status !== "open") return { say: `We have collected the ${BIN_NAMES[report.bin].toLowerCase()}, so there is nothing to withdraw.`, title: "Important" };
      const undo = store.commit("Withdraw report", (d) => {
        d.bins.missed = d.bins.missed.filter((m) => m.id !== c.reportId);
      });
      return { say: "Report withdrawn.", undo };
    }

    case "evidence.upload": {
      const item = w.benefit.evidence.find((x) => x.id === c.itemId);
      const files = Array.isArray(c.files) ? (c.files as { name: string; size: number }[]) : [];
      if (!item) return {};
      const what = item.what.replace(/^Your /, "your ");
      if (!files.length) return { say: `Choose the files first: ${what}.`, title: "There is a problem" };
      const undo = store.commit("Send evidence", (d) => {
        const x = d.benefit.evidence.find((y) => y.id === item.id)!;
        x.files = files.map((f) => ({ name: f.name, size: f.size }));
        x.status = "done";
        x.receivedAt = new Date().toISOString();
        if (d.benefit.evidence.every((y) => y.status === "done")) d.benefit.status = "assessing";
      });
      const left = store.get().benefit.evidence.filter((x) => x.status === "todo").length;
      const have = `We have ${what.startsWith("your") ? what : `your ${what}`}.`;
      return { say: left ? `${have} ${left === 1 ? "One more document" : `${left} more documents`} to send.` : `${have} That is everything we need; you hear from us within 14 days.`, undo, close: left === 0, go: left === 0 ? "/benefits" : undefined };
    }
    case "evidence.remove": {
      const undo = store.commit("Take back evidence", (d) => {
        const x = d.benefit.evidence.find((y) => y.id === c.itemId);
        if (!x) return;
        x.files = [];
        x.status = "todo";
        x.receivedAt = null;
        d.benefit.status = "awaiting-evidence";
      });
      return { say: "Taken back.", undo };
    }
    default:
      return { say: `This account cannot do "${e.name}" yet.`, title: "Important" };
  }
}
