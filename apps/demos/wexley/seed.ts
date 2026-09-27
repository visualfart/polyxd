import { daysFromNow, rng } from "../kit/store.ts";

/** Wexley's data: one resident, the council services she uses, and the letters between them. */
export interface Wexley {
  resident: { id: string; name: string; firstName: string; email: string; phone: string; address: Address; since: string };
  session: { signedIn: boolean; email: string; codeSentAt: string | null };
  zones: Zone[];
  permit: Permit;
  fines: Fine[];
  councilTax: CouncilTax;
  repairs: Repair[];
  bins: Bins;
  benefit: Benefit;
  messages: Message[];
  /** Things reviewed but not yet confirmed: a confirmation reads its own from here. */
  drafts: { permitChange: PermitChange | null; appeal: AppealDraft | null; instalmentQuote: InstalmentQuote | null };
  settings: { contact: { email: boolean; text: boolean; post: boolean } };
}

export interface Address { line1: string; line2: string; town: string; postcode: string }
export interface Zone { id: string; name: string; price: number; postcodes: string[] }
export interface Permit {
  id: string;
  zone: string;
  vehicle: { registration: string; make: string; model: string; colour: string };
  start: string;
  expiry: string;
  price: number;
  address: Address;
  /** Renewals and address changes, newest last. */
  history: { at: string; what: string }[];
}
export interface Fine {
  id: string;
  number: string;
  issued: string;
  location: string;
  contravention: string;
  amount: number;
  discountAmount: number;
  discountUntil: string;
  status: "issued" | "appealed" | "paid" | "cancelled";
  appeal?: { reason: AppealReason; explanation: string; evidence: number; sentAt: string; decideBy: string };
}
export type AppealReason = "signs-unclear" | "permit-valid" | "loading" | "vehicle-sold" | "other";
export interface CouncilTax {
  account: string;
  band: string;
  annual: number;
  paid: number;
  plan: Plan;
  /** Bills and statements, newest first. */
  statements: { id: string; date: string; description: string; amount: number }[];
}
export interface Plan { count: 10 | 12; day: 1 | 15 | 28; method: "direct-debit" | "card"; monthly: number; firstPayment: string; setAt: string }
export interface Repair {
  id: string;
  reference: string;
  problem: string;
  where: string;
  reported: string;
  /** Which of the four stages has been reached: 0 reported, 1 assessed, 2 appointment booked, 3 fixed. */
  stage: 0 | 1 | 2 | 3;
  priority: "emergency" | "urgent" | "routine";
  appointment: Appointment | null;
  previousAppointment: Appointment | null;
  fixedOn: string | null;
  notes: { at: string; text: string; from: "you" | "us" }[];
}
export interface Appointment { date: string; slot: "am" | "pm"; who: string }
export interface Bins {
  refuse: { day: string; next: string };
  recycling: { day: string; next: string };
  garden: { subscribed: boolean; day: string; next: string; renewsOn: string; price: number };
  lastCollected: Record<BinKind, string>;
  missed: MissedReport[];
  requests: { id: string; bin: BinKind; reason: string; at: string; status: "requested" | "delivered" }[];
}
export type BinKind = "refuse" | "recycling" | "garden" | "food";
export interface MissedReport { id: string; bin: BinKind; date: string; wasOut: boolean; reportedAt: string; collectBy: string; status: "open" | "collected" }
export interface Benefit {
  reference: string;
  type: string;
  submitted: string;
  status: "awaiting-evidence" | "assessing" | "decided";
  weeklyEstimate: number;
  deadline: string;
  evidence: EvidenceItem[];
}
export interface EvidenceItem { id: string; what: string; why: string; status: "done" | "todo"; receivedAt: string | null; files: { name: string; size: number }[] }
export interface Message { id: string; at: string; subject: string; from: string; body: string[]; read: boolean; about?: string }
export interface PermitChange { id: string; address: Address; moveDate: string; vehicleUnchanged: boolean; zone: string; feeDifference: number; madeAt: string }
export interface AppealDraft { id: string; fineId: string; reason: AppealReason; explanation: string; evidence: { name: string; size: number }[]; madeAt: string }
export interface InstalmentQuote { id: string; count: 10 | 12; day: 1 | 15 | 28; method: Plan["method"]; monthly: number; firstPayment: string; lastPayment: string; total: number; madeAt: string }

export const ZONES: Zone[] = [
  { id: "A", name: "Station", price: 120, postcodes: ["WX1 1"] },
  { id: "B", name: "Town centre", price: 100, postcodes: ["WX1 2", "WX1 3"] },
  { id: "C", name: "Northfield", price: 85, postcodes: ["WX2 4", "WX2 5"] },
  { id: "D", name: "Southbrook", price: 60, postcodes: ["WX3 1", "WX3 2"] },
];

const HOME: Address = { line1: "14 Larch Close", line2: "", town: "Wexley", postcode: "WX2 4QR" };
const money = (n: number) => Math.round(n * 100) / 100;

/** The next occurrence of a weekday (0 Sunday … 6 Saturday), `offsetWeeks` weeks on, as ISO at 7am. */
export function nextWeekday(dow: number, offsetWeeks = 0): string {
  const d = new Date();
  d.setHours(7, 0, 0, 0);
  const ahead = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + ahead + offsetWeeks * 7);
  return d.toISOString();
}

export function seed(): Wexley {
  const rand = rng(20261004);
  const pcnDigits = String(Math.floor(rand() * 1e8)).padStart(8, "0");
  const annual = 1932.48;
  const monthly = money(annual / 10);
  // The council tax year runs from April; by late September four of ten instalments are paid.
  const paid = money(monthly * 4);
  const statements = [
    { id: "st_4", date: daysFromNow(-27, 8), description: "Payment received", amount: -monthly },
    { id: "st_3", date: daysFromNow(-58, 8), description: "Payment received", amount: -monthly },
    { id: "st_2", date: daysFromNow(-89, 8), description: "Payment received", amount: -monthly },
    { id: "st_1", date: daysFromNow(-120, 8), description: "Payment received", amount: -monthly },
    { id: "st_0", date: daysFromNow(-178, 8), description: "Annual bill, band C", amount: annual },
  ];
  const tuesday = nextWeekday(2);
  const nextTuesday = nextWeekday(2, 1);
  const wednesday = nextWeekday(3);
  // Recycling alternates with refuse: one Tuesday refuse, the next both.
  return {
    resident: { id: "r_amira", name: "Amira Haddad", firstName: "Amira", email: "amira.haddad@example.com", phone: "07700 900312", address: HOME, since: daysFromNow(-1460) },
    session: { signedIn: false, email: "", codeSentAt: null },
    zones: ZONES,
    permit: {
      id: "perm_1",
      zone: "C",
      vehicle: { registration: "WX21 TFR", make: "Toyota", model: "Yaris", colour: "Blue" },
      start: daysFromNow(-318),
      expiry: daysFromNow(47, 23, 59),
      price: 85,
      address: HOME,
      history: [{ at: daysFromNow(-318), what: "Permit issued for zone C" }],
    },
    fines: [
      {
        id: "pcn_1",
        number: `WX${pcnDigits}`,
        issued: daysFromNow(-6, 14, 12),
        location: "Mill Street, outside number 22",
        contravention: "Parked in a permit zone without a valid permit",
        amount: 70,
        discountAmount: 35,
        discountUntil: daysFromNow(8, 23, 59),
        status: "issued",
      },
    ],
    councilTax: {
      account: "70 4412 9083",
      band: "C",
      annual,
      paid,
      plan: { count: 10, day: 1, method: "direct-debit", monthly, firstPayment: daysFromNow(-150, 8), setAt: daysFromNow(-178) },
      statements,
    },
    repairs: [
      {
        id: "rep_1",
        reference: "REP 4821",
        problem: "Leaking kitchen tap",
        where: "Kitchen",
        reported: daysFromNow(-9, 10, 40),
        stage: 2,
        priority: "routine",
        appointment: { date: daysFromNow(5, 8), slot: "am", who: "A plumber from Wexley Homes" },
        previousAppointment: null,
        fixedOn: null,
        notes: [
          { at: daysFromNow(-9, 10, 40), text: "The cold tap in the kitchen drips all the time and the cupboard under it is getting wet.", from: "you" },
          { at: daysFromNow(-7, 15, 5), text: "We looked at your photos. This is a routine repair, so we fix it within 20 working days.", from: "us" },
        ],
      },
      {
        id: "rep_0",
        reference: "REP 3390",
        problem: "Bathroom extractor fan not working",
        where: "Bathroom",
        reported: daysFromNow(-112, 9, 15),
        stage: 3,
        priority: "routine",
        appointment: { date: daysFromNow(-98, 13), slot: "pm", who: "An electrician from Wexley Homes" },
        previousAppointment: null,
        fixedOn: daysFromNow(-98, 15, 20),
        notes: [{ at: daysFromNow(-98, 15, 20), text: "Fan replaced. Fixed by the electrician on the day.", from: "us" }],
      },
    ],
    bins: {
      refuse: { day: "Tuesday", next: tuesday },
      recycling: { day: "Tuesday, every other week", next: nextTuesday },
      garden: { subscribed: true, day: "Wednesday, every other week", next: wednesday, renewsOn: nextMarch(), price: 48 },
      lastCollected: { refuse: nextWeekday(2, -1), recycling: nextWeekday(2, -1), garden: nextWeekday(3, -1), food: nextWeekday(2, -1) },
      missed: [],
      requests: [],
    },
    benefit: {
      reference: "HB 2026 018274",
      type: "Housing benefit",
      submitted: daysFromNow(-16, 11, 30),
      status: "awaiting-evidence",
      weeklyEstimate: 96.4,
      deadline: weekdayFromNow(13),
      evidence: [
        { id: "identity", what: "Proof of who you are", why: "Your passport or driving licence.", status: "done", receivedAt: daysFromNow(-16, 11, 30), files: [{ name: "passport.jpg", size: 1843200 }] },
        { id: "tenancy", what: "Your tenancy agreement", why: "The signed agreement showing your rent.", status: "done", receivedAt: daysFromNow(-16, 11, 30), files: [{ name: "tenancy-agreement.pdf", size: 402100 }] },
        { id: "payslips", what: "Your last 2 payslips", why: "So we can work out your weekly income.", status: "todo", receivedAt: null, files: [] },
        { id: "bank", what: "Bank statements for the last 2 months", why: "For every account in your name, showing your savings.", status: "todo", receivedAt: null, files: [] },
      ],
    },
    messages: [
      {
        id: "msg_5",
        at: daysFromNow(-2, 9, 5),
        subject: "Your housing benefit claim: we need 2 more documents",
        from: "Benefits team",
        about: "/benefits",
        read: false,
        body: [
          "Thank you for your housing benefit claim. We have your proof of identity and your tenancy agreement.",
          "To work out your claim we also need your last 2 payslips and bank statements for the last 2 months.",
          "Send them through your account within 14 days. If we do not get them, we decide your claim on what we have, and it may be refused.",
        ],
      },
      {
        id: "msg_4",
        at: daysFromNow(-6, 16, 40),
        subject: "Penalty charge notice: parking on Mill Street",
        from: "Parking services",
        about: "/permits",
        read: false,
        body: ["A penalty charge notice was issued to your vehicle on Mill Street. The charge is £70, or £35 if you pay within 14 days.", "If you think the notice is wrong, you can appeal through your account. The fine is paused while we consider it."],
      },
      {
        id: "msg_3",
        at: daysFromNow(-7, 15, 5),
        subject: "Repair REP 4821: appointment booked",
        from: "Wexley Homes",
        about: "/repairs/rep_1",
        read: true,
        body: ["We have looked at your repair request for the leaking kitchen tap.", "A plumber will visit between 8am and 1pm. Someone over 18 needs to be at home to let them in.", "If the time does not suit you, you can change it through your account."],
      },
      {
        id: "msg_2",
        at: daysFromNow(-13, 8, 30),
        subject: "Your parking permit ends in 60 days",
        from: "Parking services",
        about: "/permits",
        read: true,
        body: ["Your zone C permit for WX21 TFR ends soon. Renew it through your account to keep parking near home without a break.", "The price for the year is £85."],
      },
      {
        id: "msg_1",
        at: daysFromNow(-178, 8),
        subject: "Your council tax bill for the year",
        from: "Council tax",
        about: "/council-tax",
        read: true,
        body: ["Your property is in band C. The charge for the year is £1,932.48, paid in 10 instalments by Direct Debit on the 1st of each month.", "You can change the number of instalments or the payment day through your account."],
      },
    ],
    drafts: { permitChange: null, appeal: null, instalmentQuote: null },
    settings: { contact: { email: true, text: true, post: false } },
  };
}

/** A deadline `days` on, moved to the Friday before if it lands on a weekend: the council keeps office hours. */
function weekdayFromNow(days: number): string {
  const d = new Date(daysFromNow(days, 23, 59));
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  return d.toISOString();
}

/** Next 31 March: garden waste runs April to March. */
export function nextMarch(): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  const year = d.getMonth() > 2 ? d.getFullYear() + 1 : d.getFullYear();
  d.setFullYear(year, 2, 31);
  return d.toISOString();
}

/* ---- Derived helpers the screens and views share ---- */

export const zone = (w: Wexley, id: string) => w.zones.find((z) => z.id === id) ?? w.zones[0];
export const zoneName = (w: Wexley, id: string) => `Zone ${id}, ${zone(w, id).name}`;
/** The zone a postcode is in, from its outward code and first inward digit ("WX1 2HD" → B). */
export const zoneForPostcode = (w: Wexley, postcode: string) => {
  const key = postcode.toUpperCase().replace(/\s+/g, "").replace(/^([A-Z]+\d+)(\d)/, "$1 $2").slice(0, 5);
  return w.zones.find((z) => z.postcodes.includes(key)) ?? null;
};
export const oneLine = (a: Address) => [a.line1, a.line2, a.town, a.postcode].filter(Boolean).join(", ");
export const vehicleLine = (p: Permit) => `${p.vehicle.colour} ${p.vehicle.make} ${p.vehicle.model}, ${p.vehicle.registration}`;
export const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
export const repair = (w: Wexley, id?: string) => w.repairs.find((r) => r.id === id);
export const openFine = (w: Wexley) => w.fines.find((f) => f.status === "issued") ?? w.fines[0];

export const BIN_NAMES: Record<BinKind, string> = { refuse: "Refuse (black bin)", recycling: "Recycling (blue bin)", garden: "Garden waste (green bin)", food: "Food waste (small caddy)" };
export const SLOT_NAMES: Record<Appointment["slot"], string> = { am: "8am to 1pm", pm: "1pm to 6pm" };
export const STAGE_NAMES = ["Reported", "Assessed", "Appointment booked", "Fixed"] as const;

/** The date of the next `day` of the month (1st, 15th, 28th), at least a week away so a Direct Debit can be set up. */
export function nextPaymentDay(day: number): string {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  d.setDate(day);
  while (d.getTime() < Date.now() + 7 * 86400000) d.setMonth(d.getMonth() + 1, day);
  return d.toISOString();
}

/** Monthly amount for a plan over what is still to pay this year. */
export function planMonthly(w: Wexley, count: number): number {
  return money((w.councilTax.annual - w.councilTax.paid) / count);
}
