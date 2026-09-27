import { daysFromNow, ids, rng } from "../kit/store.ts";

/** Halden's data: one person, one account, three months of ordinary life. */
export interface Halden {
  person: { id: string; name: string; firstName: string; email: string; city: string; memberSince: string };
  account: { id: string; name: string; sortCode: string; accountNumber: string; currency: string; openingBalance: number };
  card: { id: string; last4: string; expiry: string; network: string; frozen: boolean; frozenAt: string | null; contactlessLimit: number; onlinePayments: boolean };
  categories: Category[];
  merchants: Merchant[];
  payees: Payee[];
  payments: Payment[];
  budgets: Budget[];
  subscriptions: Subscription[];
  disputes: Dispute[];
  quotes: Quote[];
  settings: { notifications: { payments: boolean; budgets: boolean; security: boolean }; appearance: "system" | "light" | "dark"; onboarded: boolean };
}

export interface Category { id: string; name: string; icon: string }
export interface Merchant { id: string; name: string; category: string; where: string }
export interface Payee { id: string; name: string; kind: "person" | "business"; sortCode: string; accountNumber: string; reference: string; addedAt: string }
export interface Payment {
  id: string;
  at: string;
  /** Negative leaves the account. */
  amount: number;
  description: string;
  category: string;
  merchantId?: string;
  payeeId?: string;
  reference?: string;
  /** Paid with the card (as opposed to a bank payment). */
  card: boolean;
  status: "settled" | "pending" | "refund-pending" | "refunded";
  disputeId?: string;
}
export interface Budget { category: string; limit: number; previousLimit: number | null; setAt: string }
export interface Subscription { id: string; merchantId: string; amount: number; cadence: "monthly" | "annual"; nextOn: string; active: boolean; since: string }
export interface Dispute { id: string; paymentId: string; reason: "duplicate" | "unrecognised" | "wrong-amount" | "not-received"; note: string; raisedAt: string; status: "open" | "refunded" | "declined"; decideBy: string }
export interface Quote { id: string; payeeId: string; amount: number; reference: string; fee: number; arrives: string; balanceAfter: number; madeAt: string }

export const CATEGORIES: Category[] = [
  { id: "groceries", name: "Groceries", icon: "basket" },
  { id: "eating-out", name: "Eating out", icon: "restaurant" },
  { id: "coffee", name: "Coffee", icon: "cup" },
  { id: "transport", name: "Transport", icon: "car" },
  { id: "shopping", name: "Shopping", icon: "bag" },
  { id: "bills", name: "Bills", icon: "bolt" },
  { id: "subscriptions", name: "Subscriptions", icon: "repeat" },
  { id: "entertainment", name: "Entertainment", icon: "ticket" },
  { id: "health", name: "Health", icon: "heart" },
  { id: "rent", name: "Rent", icon: "home" },
  { id: "transfers", name: "Sent to people", icon: "send" },
  { id: "income", name: "Income", icon: "arrow-down" },
];

const MERCHANTS: Merchant[] = [
  { id: "m_greenway", name: "Greenway Market", category: "groceries", where: "Gloucester Road" },
  { id: "m_corner", name: "Corner Deli", category: "groceries", where: "Cotham Hill" },
  { id: "m_kettle", name: "Kettle & Co", category: "coffee", where: "Stokes Croft" },
  { id: "m_roast", name: "Small Batch Roasters", category: "coffee", where: "Park Street" },
  { id: "m_bao", name: "Bao Bao", category: "eating-out", where: "Wapping Wharf" },
  { id: "m_nonna", name: "Pizzeria Nonna", category: "eating-out", where: "Clifton" },
  { id: "m_tidal", name: "Tidal Fish Bar", category: "eating-out", where: "Harbourside" },
  { id: "m_ryde", name: "Ryde", category: "transport", where: "App" },
  { id: "m_gwr", name: "Western Rail", category: "transport", where: "Temple Meads" },
  { id: "m_bus", name: "Bristol Buses", category: "transport", where: "Tap on" },
  { id: "m_larkin", name: "Larkin & Sons", category: "shopping", where: "Cabot Circus" },
  { id: "m_pages", name: "Pages Bookshop", category: "shopping", where: "Christmas Steps" },
  { id: "m_ember", name: "Ember Energy", category: "bills", where: "Direct debit" },
  { id: "m_aqua", name: "Aqua Water", category: "bills", where: "Direct debit" },
  { id: "m_wexley", name: "Wexley Borough Council", category: "bills", where: "Council tax" },
  { id: "m_wavelength", name: "Wavelength", category: "subscriptions", where: "Music" },
  { id: "m_streamline", name: "Streamline", category: "subscriptions", where: "TV" },
  { id: "m_northwave", name: "Northwave Gym", category: "subscriptions", where: "Membership" },
  { id: "m_cloudloft", name: "Cloudloft", category: "subscriptions", where: "Storage, 2 TB" },
  { id: "m_watershed", name: "Watershed Cinema", category: "entertainment", where: "Harbourside" },
  { id: "m_pharmacy", name: "Hillside Pharmacy", category: "health", where: "Whiteladies Road" },
  { id: "m_marlow", name: "Marlow Studio", category: "income", where: "Salary" },
];

const PAYEES: Payee[] = [
  { id: "p_priya", name: "Priya Raman", kind: "person", sortCode: "04-00-04", accountNumber: "31982204", reference: "", addedAt: daysFromNow(-140) },
  { id: "p_tom", name: "Tom Ashby", kind: "person", sortCode: "20-45-77", accountNumber: "70316645", reference: "", addedAt: daysFromNow(-120) },
  { id: "p_amara", name: "Amara Osei", kind: "person", sortCode: "60-83-71", accountNumber: "12930486", reference: "", addedAt: daysFromNow(-75) },
  { id: "p_landlord", name: "Redcliffe Lettings", kind: "business", sortCode: "30-96-26", accountNumber: "00471563", reference: "FLAT 4B OKAFOR", addedAt: daysFromNow(-400) },
  { id: "p_dan", name: "Dan Whitfield", kind: "person", sortCode: "11-22-33", accountNumber: "55019822", reference: "", addedAt: daysFromNow(-30) },
];

const money = (n: number) => Math.round(n * 100) / 100;

export function seed(): Halden {
  const rand = rng(20260927);
  const nextId = ids("pay");
  const payments: Payment[] = [];
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => money(lo + rand() * (hi - lo));
  const add = (p: Omit<Payment, "id" | "card" | "status"> & { card?: boolean; status?: Payment["status"] }) =>
    payments.push({ id: nextId(), card: p.merchantId ? !["m_ember", "m_aqua", "m_wexley", "m_marlow"].includes(p.merchantId) : false, status: "settled", ...p });

  // 95 days back to today. Day 0 is today; hours vary so the list reads like life, not a script.
  for (let d = -95; d <= 0; d++) {
    const date = new Date();
    date.setDate(date.getDate() + d);
    const dom = date.getDate();
    const dow = date.getDay();
    // Salary on the 25th, rent on the 1st, bills spread over the month.
    if (dom === 25) add({ at: daysFromNow(d, 6, 2), amount: 2860, description: "Salary", category: "income", merchantId: "m_marlow" });
    if (dom === 1) add({ at: daysFromNow(d, 7, 30), amount: -1150, description: "Rent", category: "rent", payeeId: "p_landlord", reference: "FLAT 4B OKAFOR" });
    if (dom === 3) add({ at: daysFromNow(d, 8, 0), amount: -78.4, description: "Electricity and gas", category: "bills", merchantId: "m_ember" });
    if (dom === 7) add({ at: daysFromNow(d, 8, 0), amount: -31.2, description: "Water", category: "bills", merchantId: "m_aqua" });
    if (dom === 15) add({ at: daysFromNow(d, 8, 0), amount: -164, description: "Council tax", category: "bills", merchantId: "m_wexley" });
    // Subscriptions on fixed days.
    if (dom === 5) add({ at: daysFromNow(d, 3, 12), amount: -10.99, description: "Wavelength", category: "subscriptions", merchantId: "m_wavelength" });
    if (dom === 12) add({ at: daysFromNow(d, 3, 15), amount: -8.99, description: "Streamline", category: "subscriptions", merchantId: "m_streamline" });
    if (dom === 18) add({ at: daysFromNow(d, 4, 5), amount: -34, description: "Northwave Gym", category: "subscriptions", merchantId: "m_northwave" });
    if (dom === 22) add({ at: daysFromNow(d, 3, 40), amount: -7.99, description: "Cloudloft", category: "subscriptions", merchantId: "m_cloudloft" });
    // Coffee most weekdays.
    if (dow >= 1 && dow <= 5 && rand() < 0.7) {
      const m = pick(["m_kettle", "m_kettle", "m_roast"]);
      add({ at: daysFromNow(d, 8, 20 + Math.floor(rand() * 30)), amount: -between(2.8, 4.6), description: m === "m_kettle" ? "Kettle & Co" : "Small Batch Roasters", category: "coffee", merchantId: m });
    }
    // Groceries two or three times a week.
    if ((dow === 2 || dow === 6 || (dow === 4 && rand() < 0.5)) && d !== 0) {
      const m = pick(["m_greenway", "m_greenway", "m_corner"]);
      add({ at: daysFromNow(d, 18, Math.floor(rand() * 50)), amount: -between(m === "m_corner" ? 6 : 18, m === "m_corner" ? 16 : 54), description: m === "m_greenway" ? "Greenway Market" : "Corner Deli", category: "groceries", merchantId: m });
    }
    // Eating out at the weekend and the odd weeknight.
    if ((dow === 5 || dow === 6) && rand() < 0.75) {
      const m = pick(["m_bao", "m_nonna", "m_tidal"]);
      add({ at: daysFromNow(d, 19, 30 + Math.floor(rand() * 60)), amount: -between(14, 46), description: MERCHANTS.find((x) => x.id === m)!.name, category: "eating-out", merchantId: m });
    } else if (dow === 3 && rand() < 0.3) {
      add({ at: daysFromNow(d, 13, 5), amount: -between(9, 15), description: "Bao Bao", category: "eating-out", merchantId: "m_bao" });
    }
    // Transport: buses on weekdays, a train some weeks, the odd ride home.
    if (dow >= 1 && dow <= 5 && rand() < 0.6) add({ at: daysFromNow(d, 8, 5), amount: -2, description: "Bristol Buses", category: "transport", merchantId: "m_bus" });
    if (dow === 5 && rand() < 0.25) add({ at: daysFromNow(d, 17, 45), amount: -between(24, 41), description: "Western Rail", category: "transport", merchantId: "m_gwr" });
    if (dow === 6 && rand() < 0.35) add({ at: daysFromNow(d, 23, 10 + Math.floor(rand() * 40)), amount: -between(8, 19), description: "Ryde", category: "transport", merchantId: "m_ryde" });
    // Shopping, films, the pharmacy: now and then.
    if (rand() < 0.08) add({ at: daysFromNow(d, 15, 20), amount: -between(12, 89), description: pick(["Larkin & Sons", "Pages Bookshop"]), category: "shopping", merchantId: pick(["m_larkin", "m_pages"]) });
    if (dow === 0 && rand() < 0.3) add({ at: daysFromNow(d, 19, 0), amount: -between(9, 22), description: "Watershed Cinema", category: "entertainment", merchantId: "m_watershed" });
    if (rand() < 0.05) add({ at: daysFromNow(d, 12, 30), amount: -between(4, 26), description: "Hillside Pharmacy", category: "health", merchantId: "m_pharmacy" });
    // Sending money to friends: splitting things.
    if (rand() < 0.07) {
      const p = pick(["p_priya", "p_tom", "p_amara"]);
      add({ at: daysFromNow(d, 21, 12), amount: -between(8, 45), description: PAYEES.find((x) => x.id === p)!.name, category: "transfers", payeeId: p, reference: pick(["Dinner", "Tickets", "Taxi", "Birthday", "Lunch"]) });
    }
    if (rand() < 0.04) {
      const p = pick(["p_priya", "p_tom"]);
      add({ at: daysFromNow(d, 10, 40), amount: between(10, 40), description: PAYEES.find((x) => x.id === p)!.name, category: "transfers", payeeId: p, reference: "Split" });
    }
  }
  // The duplicate: a Ryde ride three nights ago, charged twice four minutes apart. The dispute ask finds it.
  add({ at: daysFromNow(-3, 23, 41), amount: -14.6, description: "Ryde", category: "transport", merchantId: "m_ryde" });
  add({ at: daysFromNow(-3, 23, 45), amount: -14.6, description: "Ryde", category: "transport", merchantId: "m_ryde" });
  // Today: a coffee that hasn't settled yet.
  add({ at: daysFromNow(0, 8, 31), amount: -3.4, description: "Kettle & Co", category: "coffee", merchantId: "m_kettle", status: "pending" });

  // Fix ids to sort by time, then rewrite the ids so the newest is highest.
  payments.sort((a, b) => a.at.localeCompare(b.at));
  const renumber = ids("pay");
  for (const p of payments) p.id = renumber();

  const monthStart = new Date();
  monthStart.setDate(1);
  return {
    person: { id: "u_maya", name: "Maya Okafor", firstName: "Maya", email: "maya@okafor.me", city: "Bristol", memberSince: daysFromNow(-412) },
    account: { id: "acc_main", name: "Current account", sortCode: "04-29-09", accountNumber: "51830774", currency: "GBP", openingBalance: 1834.22 },
    card: { id: "card_1", last4: "4471", expiry: "09/28", network: "Visa", frozen: false, frozenAt: null, contactlessLimit: 100, onlinePayments: true },
    categories: CATEGORIES,
    merchants: MERCHANTS,
    payees: PAYEES,
    payments,
    budgets: [
      { category: "groceries", limit: 260, previousLimit: null, setAt: daysFromNow(-60) },
      { category: "eating-out", limit: 150, previousLimit: null, setAt: daysFromNow(-60) },
      { category: "transport", limit: 90, previousLimit: null, setAt: daysFromNow(-60) },
    ],
    subscriptions: [
      { id: "sub_wavelength", merchantId: "m_wavelength", amount: 10.99, cadence: "monthly", nextOn: nextDay(5), active: true, since: daysFromNow(-380) },
      { id: "sub_streamline", merchantId: "m_streamline", amount: 8.99, cadence: "monthly", nextOn: nextDay(12), active: true, since: daysFromNow(-200) },
      { id: "sub_northwave", merchantId: "m_northwave", amount: 34, cadence: "monthly", nextOn: nextDay(18), active: true, since: daysFromNow(-95) },
      { id: "sub_cloudloft", merchantId: "m_cloudloft", amount: 7.99, cadence: "monthly", nextOn: nextDay(22), active: true, since: daysFromNow(-300) },
    ],
    disputes: [],
    quotes: [],
    settings: { notifications: { payments: true, budgets: true, security: true }, appearance: "system", onboarded: false },
  };
}

/** The next occurrence of a day of the month, as an ISO date. */
function nextDay(dom: number): string {
  const d = new Date();
  d.setHours(3, 0, 0, 0);
  if (d.getDate() >= dom) d.setMonth(d.getMonth() + 1);
  d.setDate(dom);
  return d.toISOString();
}

/* ---- Derived views the screens and surfaces share ---- */

export const balance = (h: Halden) => money(h.account.openingBalance + h.payments.filter((p) => p.status !== "refunded").reduce((s, p) => s + p.amount, 0));

export const merchant = (h: Halden, id?: string) => h.merchants.find((m) => m.id === id);
export const payee = (h: Halden, id?: string) => h.payees.find((p) => p.id === id);
export const category = (h: Halden, id: string) => h.categories.find((c) => c.id === id) ?? { id, name: id, icon: "dot" };

/** "YYYY-MM" in the person's own time zone, so a payment at 23:50 stays on the day they made it. */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export const thisMonth = () => monthKey(new Date().toISOString());
export function lastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKey(d.toISOString());
}
export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Spend (positive number) per category for a month. */
export function spendByCategory(h: Halden, month: string): { category: string; name: string; total: number; count: number }[] {
  const totals = new Map<string, { total: number; count: number }>();
  for (const p of h.payments) {
    if (monthKey(p.at) !== month || p.amount >= 0 || p.status === "refunded") continue;
    const t = totals.get(p.category) ?? { total: 0, count: 0 };
    t.total = money(t.total - p.amount);
    t.count++;
    totals.set(p.category, t);
  }
  return [...totals]
    .map(([category, t]) => ({ category, name: category === "transfers" ? "Sent to people" : (h.categories.find((c) => c.id === category)?.name ?? category), ...t }))
    .sort((a, b) => b.total - a.total);
}

export const spent = (h: Halden, month: string, categoryId?: string) => money(h.payments.filter((p) => monthKey(p.at) === month && p.amount < 0 && p.status !== "refunded" && (!categoryId || p.category === categoryId)).reduce((s, p) => s - p.amount, 0));
/** Spend in a month up to and including a day of the month: a fair comparison mid-month. */
export const spentToDay = (h: Halden, month: string, day: number, categoryId?: string) => money(h.payments.filter((p) => monthKey(p.at) === month && new Date(p.at).getDate() <= day && p.amount < 0 && p.status !== "refunded" && (!categoryId || p.category === categoryId)).reduce((s, p) => s - p.amount, 0));
export const income = (h: Halden, month: string) => money(h.payments.filter((p) => monthKey(p.at) === month && p.amount > 0).reduce((s, p) => s + p.amount, 0));

export const monthName = (key: string, style: "long" | "short" = "long") => new Date(`${key}-01T12:00:00`).toLocaleDateString("en-GB", { month: style });
