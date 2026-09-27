import { daysFromNow, ids, rng } from "../kit/store.ts";
import { fromDay, isoDay, round2 } from "./format.ts";
import { mediaRef, type Silhouette } from "./media.ts";

/**
 * Quay's data: the admin of Lantern & Wick, a small candle and home-fragrance brand shipping from
 * Portland, Oregon. Sixty products, ninety days of orders on a believable daily curve, ninety
 * customers, the discounts, the carts people left, and the ad campaigns. Everything derives from one
 * seed so every visitor sees the same store; the numbers on Home, Orders and Analytics all come from
 * the same orders, so they agree.
 *
 * Last week is deliberately bad: the two best sellers sold out for six days and the launch campaign
 * was paused for five, so "why did sales drop last week" has a true answer in the data.
 */
export interface Quay {
  shop: Shop;
  products: Product[];
  collections: Collection[];
  orders: Order[];
  drafts: DraftOrder[];
  customers: Customer[];
  discounts: Discount[];
  checkouts: Checkout[];
  campaigns: Campaign[];
  traffic: { date: string; sessions: number }[];
  settings: { appearance: "system" | "light" | "dark" };
}

export interface Shop {
  name: string;
  email: string;
  phone: string;
  address: Address;
  currency: string;
  timezone: string;
  owner: { name: string; email: string };
}
export interface Address { name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string }

export type ProductType = "candle" | "diffuser" | "melt" | "gift" | "accessory";
export type ProductStatus = "active" | "draft" | "archived";
export interface Product {
  id: string;
  title: string;
  handle: string;
  type: ProductType;
  status: ProductStatus;
  description: string;
  vendor: string;
  category: string;
  tags: string[];
  collections: string[];
  media: string[];
  /** The option each variant differs by: "Size", "Pack", "Finish"; none for a single-variant product. */
  option?: string;
  variants: Variant[];
  createdAt: string;
}
export interface Variant {
  id: string;
  title: string;
  sku: string;
  price: number;
  compareAt?: number;
  cost: number;
  /** Ounces. */
  weight: number;
  trackQuantity: boolean;
  inventory: number;
  incoming?: { qty: number; expectedAt: string };
  /** Days this variant was at zero, as local day keys, inclusive. */
  stockouts: { from: string; to: string }[];
}
export interface Collection { id: string; title: string; handle: string; kind: "manual" | "automated"; rule?: string; description: string }

export type PaymentStatus = "paid" | "pending" | "partially_refunded" | "refunded";
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled";
export type OrderStatus = "open" | "archived" | "canceled";
export type Source = "ads" | "organic" | "email" | "social" | "direct";
export interface LineItem { id: string; productId: string; variantId: string; title: string; variantTitle: string; sku: string; media: string; qty: number; price: number; fulfilled: number; refunded: number }
export interface Refund { id: string; at: string; amount: number; reason: string; items: { lineItemId: string; qty: number }[]; restocked: boolean }
export interface Event { id: string; at: string; kind: "placed" | "paid" | "fulfilled" | "delivered" | "refund" | "canceled" | "comment" | "email" | "print" | "archived" | "note"; text: string; author?: string }
export interface Order {
  id: string;
  number: number;
  customerId: string;
  createdAt: string;
  promisedShipAt: string;
  items: LineItem[];
  subtotal: number;
  discountCode?: string;
  discountAmount: number;
  shipping: number;
  tax: number;
  total: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  status: OrderStatus;
  source: Source;
  refunds: Refund[];
  fulfilledAt?: string;
  canceledAt?: string;
  cancelReason?: string;
  tracking?: string;
  note?: string;
  tags: string[];
  timeline: Event[];
  shippingAddress: Address;
  billingSame: boolean;
  printedAt?: string;
}
export interface DraftOrder { id: string; number: number; customerId: string; createdAt: string; items: LineItem[]; subtotal: number; shipping: number; tax: number; total: number; status: "open" | "invoice_sent" | "completed"; note?: string }
export interface Note { id: string; at: string; body: string }
export interface Customer { id: string; firstName: string; lastName: string; email: string; phone?: string; subscribed: boolean; address: Address; createdAt: string; notes: Note[]; tags: string[] }

export type DiscountType = "amount_off_order" | "amount_off_products" | "buy_x_get_y" | "free_shipping";
export type DiscountMethod = "code" | "automatic";
export type Audience = "everyone" | "returning" | "new" | "lapsed";
export interface Discount {
  id: string;
  title: string;
  code?: string;
  method: DiscountMethod;
  type: DiscountType;
  valueKind: "percentage" | "fixed";
  value: number;
  minOrder?: number;
  /** For amount_off_products: which product type it applies to. */
  appliesTo?: ProductType;
  audience: Audience;
  startsAt: string;
  endsAt?: string;
  enabled: boolean;
  createdAt: string;
  usageLimit?: number;
}
export interface Checkout { id: string; customerId?: string; email: string; name: string; createdAt: string; items: LineItem[]; subtotal: number; emailStatus: "not_sent" | "sent" | "opened" | "recovered"; remindedAt?: string; discountCode?: string; recoveredOrderId?: string }
export interface Campaign { id: string; name: string; channel: string; status: "active" | "paused"; dailyBudget: number; startedAt: string; pauses: { from: string; to: string }[] }

export const TYPE_LABEL: Record<ProductType, string> = { candle: "Candle", diffuser: "Diffuser", melt: "Wax melt", gift: "Gift set", accessory: "Accessory" };
export const TYPES = Object.keys(TYPE_LABEL) as ProductType[];
export const CATEGORY: Record<ProductType, string> = { candle: "Home & Garden > Decor > Candles", diffuser: "Home & Garden > Decor > Home Fragrances", melt: "Home & Garden > Decor > Home Fragrances", gift: "Home & Garden > Decor > Home Fragrances", accessory: "Home & Garden > Decor > Candle Accessories" };
export const VENDOR = "Lantern & Wick";
export const PAYMENT_LABEL: Record<PaymentStatus, string> = { paid: "Paid", pending: "Pending", partially_refunded: "Partially refunded", refunded: "Refunded" };
export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = { unfulfilled: "Unfulfilled", partial: "Partially fulfilled", fulfilled: "Fulfilled" };
export const AUDIENCE_LABEL: Record<Audience, string> = { everyone: "All customers", returning: "Returning customers", new: "New customers", lapsed: "Customers who haven't ordered in 60 days" };
export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = { amount_off_order: "Amount off order", amount_off_products: "Amount off products", buy_x_get_y: "Buy X get Y", free_shipping: "Free shipping" };

const SCENTS: [string, string][] = [
  ["Amber & Oak", "Warm amber over dry oak and a little smoke. The one people come back for."],
  ["Sea Salt & Sage", "Salt air, crushed sage and driftwood. Cool and clean."],
  ["Fig & Cassis", "Green fig, blackcurrant and cedar. Sweet without being sugary."],
  ["Cedar Smoke", "Split cedar, campfire and black pepper. For the first cold evening."],
  ["Lavender Field", "French lavender with a little chamomile. The bedside one."],
  ["Vanilla Bean", "Whole vanilla, tonka and a pinch of salt. Not a bakery."],
  ["Black Currant", "Tart currant, violet leaf and musk. Darker than it sounds."],
  ["Fresh Linen", "Cotton, white tea and rain. A window open in April."],
  ["Orange Blossom", "Neroli, bitter orange and honey. Bright and short-lived, like spring."],
  ["Pine & Birch", "Pine needle, birch tar and moss. The forest, not the cleaner."],
  ["Tobacco Leaf", "Cured tobacco, leather and a drop of rum. The study."],
  ["Rose Water", "Damask rose, cucumber and white musk. Light enough for daytime."],
  ["Eucalyptus Mint", "Eucalyptus, spearmint and a little sea salt. The shower one."],
  ["Sandalwood", "Mysore sandalwood, cardamom and cream. Slow burning, in every sense."],
];

const FIRST = ["Maya", "Jonas", "Priya", "Theo", "Leah", "Marcus", "Ines", "Owen", "Sofia", "Elliot", "Hana", "Caleb", "Nadia", "Rowan", "Amara", "Dev", "Esme", "Finn", "Greta", "Idris", "June", "Kofi", "Lena", "Milo", "Noor", "Oscar", "Petra", "Quinn", "Rosa", "Silas", "Tamsin", "Uri", "Vera", "Wes", "Yara", "Zeke", "Bea", "Cole", "Dana", "Ezra"];
const LAST = ["Okafor", "Lindqvist", "Marsh", "Delgado", "Nakamura", "Petrov", "Whitfield", "Abara", "Sorensen", "Castellano", "Byrne", "Haldane", "Mbeki", "Roux", "Kaur", "Ferreira", "Novak", "Achebe", "Lund", "Hartigan", "Reyes", "Tanaka", "Bell", "Ortiz", "Natarajan", "Solberg", "Whitlock", "Haddad", "Moreau", "Kim"];
const CITIES: [string, string, string, number][] = [
  ["Portland", "OR", "972", 0],
  ["Portland", "OR", "972", 0],
  ["Portland", "OR", "972", 0],
  ["Bend", "OR", "977", 0],
  ["Eugene", "OR", "974", 0],
  ["Seattle", "WA", "981", 0.1025],
  ["Tacoma", "WA", "984", 0.102],
  ["San Francisco", "CA", "941", 0.0863],
  ["Oakland", "CA", "946", 0.1025],
  ["Sacramento", "CA", "958", 0.0875],
  ["Denver", "CO", "802", 0.0881],
  ["Boise", "ID", "837", 0.06],
  ["Austin", "TX", "787", 0.0825],
  ["Chicago", "IL", "606", 0.1025],
  ["Brooklyn", "NY", "112", 0.08875],
  ["Minneapolis", "MN", "554", 0.09025],
  ["Nashville", "TN", "372", 0.0925],
  ["Salt Lake City", "UT", "841", 0.0775],
  ["Phoenix", "AZ", "850", 0.086],
  ["Missoula", "MT", "598", 0],
];
const STREETS = ["SE Hawthorne Blvd", "N Mississippi Ave", "NW 23rd Ave", "Alberta St", "Pine St", "Capitol Hill Ave", "Valencia St", "Larimer St", "S Congress Ave", "N Milwaukee Ave", "Bedford Ave", "Hennepin Ave", "12th Ave S", "State St", "Mill Ave", "Higgins Ave"];

const COMMENTS = ["Customer asked for a gift note: \"Happy housewarming, love M & J\".", "Left a voicemail about delivery timing; wants it before the weekend.", "Repeat customer, third order this year.", "Asked whether the 14 oz comes in Cedar Smoke. Told her it's back next month.", "Packaged with extra padding: two glass items."];

const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const day = (offset: number) => isoDay(daysFromNow(offset, 12));
/** ISO on a local day at a given hour. */
const at = (dayKey: string, hour: number, minute = 0) => {
  const d = fromDay(dayKey);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const addDays = (iso: string, n: number) => new Date(new Date(iso).getTime() + n * 86400000).toISOString();

/** Two business days after an order, 5pm: what the store promises on the checkout page. */
export function promisedShip(createdAt: string): string {
  const d = new Date(createdAt);
  let left = 2;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

export function seed(): Quay {
  const rand = rng(20260928);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const nextProduct = ids("prd");
  const nextVariant = ids("var");
  const nextCustomer = ids("cus");
  const nextOrder = ids("ord");
  const nextItem = ids("li");
  const nextEvent = ids("ev");
  const nextRefund = ids("rf");
  const nextCheckout = ids("chk");
  const nextNote = ids("note");
  const nextDraft = ids("drf");

  /* ---- Products ---- */
  const products: Product[] = [];
  const created = () => daysFromNow(-between(120, 700), 10);
  const variant = (title: string, sku: string, price: number, cost: number, weight: number, inventory: number, compareAt?: number): Variant => ({ id: nextVariant(), title, sku, price, compareAt, cost, weight, trackQuantity: true, inventory, stockouts: [] });
  const add = (p: Omit<Product, "id" | "handle" | "vendor" | "category" | "createdAt">) => {
    const id = nextProduct();
    products.push({ id, handle: slug(p.title), vendor: VENDOR, category: CATEGORY[p.type], createdAt: created(), ...p });
    return products.at(-1)!;
  };

  // Candles: one product per scent, three sizes. Inventory is healthy except where the story needs it.
  const candleStock: Record<string, [number, number, number]> = { "Amber & Oak": [31, 18, 12], "Sea Salt & Sage": [26, 25, 9], "Cedar Smoke": [22, 14, 2], "Lavender Field": [19, 3, 8], "Fig & Cassis": [28, 24, 11] };
  SCENTS.forEach(([name, description], i) => {
    const code = name.split(/\s|&/).filter(Boolean).map((w) => w.slice(0, 2).toUpperCase()).join("").slice(0, 4);
    const [s4, s8, s14] = candleStock[name] ?? [between(14, 40), between(16, 48), between(6, 22)];
    add({
      title: `${name} Candle`,
      type: "candle",
      status: i === 13 ? "draft" : "active",
      description: `${description} Coconut-soy wax, cotton wick, hand-poured in Portland. The 8 oz burns about 45 hours.`,
      tags: ["candle", slug(name), i < 4 ? "best seller" : i >= 9 ? "fall" : "core"].filter(Boolean),
      collections: ["candles", ...(i < 4 ? ["best-sellers"] : []), ...(i >= 9 && i <= 11 ? ["fall"] : []), ...(name === "Cedar Smoke" || name === "Pine & Birch" ? ["fall"] : [])],
      media: [mediaRef("candle", name), mediaRef("candle", name, 1), mediaRef("candle", name, 2)],
      option: "Size",
      variants: [variant("4 oz travel tin", `LW-C-${code}-04`, 14, 4.6, 6, s4), variant("8 oz", `LW-C-${code}-08`, 28, 8.9, 14, s8), variant("14 oz three-wick", `LW-C-${code}-14`, 48, 15.4, 26, s14, i < 4 ? undefined : 52)],
    });
  });
  // Diffusers: ten scents, a bottle and a refill.
  SCENTS.slice(0, 10).forEach(([name, description], i) => {
    const code = name.split(/\s|&/).filter(Boolean).map((w) => w.slice(0, 2).toUpperCase()).join("").slice(0, 4);
    add({
      title: `${name} Reed Diffuser`,
      type: "diffuser",
      status: "active",
      description: `${description} 100 ml, ten black reeds, about three months of scent. The refill fills the bottle twice.`,
      tags: ["diffuser", slug(name)],
      collections: ["diffusers", ...(i < 2 ? ["best-sellers"] : [])],
      media: [mediaRef("diffuser", name), mediaRef("diffuser", name, 1)],
      option: "Size",
      variants: [variant("100 ml", `LW-D-${code}-100`, 38, 11.2, 12, between(9, 30)), variant("200 ml refill", `LW-D-${code}-R`, 22, 6.4, 9, i === 3 ? 2 : between(6, 24))],
    });
  });
  // Wax melts: twelve scents, two pack sizes.
  SCENTS.slice(0, 12).forEach(([name, description], i) => {
    const code = name.split(/\s|&/).filter(Boolean).map((w) => w.slice(0, 2).toUpperCase()).join("").slice(0, 4);
    add({
      title: `${name} Wax Melts`,
      type: "melt",
      status: i === 11 ? "archived" : "active",
      description: `${description} Six or twelve cubes of the same wax as the candles; one cube scents a room for about eight hours.`,
      tags: ["wax melt", slug(name)],
      collections: ["wax-melts", ...(i === 5 ? ["under-25"] : ["under-25"])],
      media: [mediaRef("melt", name)],
      option: "Pack",
      variants: [variant("6 cubes", `LW-M-${code}-06`, 12, 3.1, 5, i === 5 ? 1 : between(12, 60)), variant("12 cubes", `LW-M-${code}-12`, 20, 5.6, 9, between(8, 40))],
    });
  });
  // Gift sets.
  const gifts: [string, string, number, number, string[], string?][] = [
    ["Discovery Set", "Four 2 oz candles across the range, so someone can find their scent. Amber & Oak, Sea Salt & Sage, Fig & Cassis, Lavender Field.", 42, 13, ["best-sellers"], "Scent family"],
    ["Cozy Evening Set", "An 8 oz Cedar Smoke candle, Cedar Smoke melts and the brass snuffer, in a kraft box with a card.", 64, 21, ["fall"]],
    ["Housewarming Set", "A 14 oz Fresh Linen candle, the Fresh Linen diffuser and a box of long matches.", 98, 32, []],
    ["Spa Set", "Eucalyptus Mint candle, Lavender Field melts and a warming lamp.", 88, 28, []],
    ["Holiday Trio", "Three 8 oz candles: Pine & Birch, Orange Blossom, Vanilla Bean. Available from October.", 78, 26, ["fall"]],
    ["Candle & Matches Set", "Any 8 oz candle with a bottle of matches and the brass lid.", 44, 14, ["under-50"]],
    ["Diffuser & Candle Pair", "The same scent twice: the 8 oz candle and the 100 ml diffuser.", 62, 19, []],
    ["Wax Melt Sampler", "Six scents, six cubes each, in a tin. The wax-melt customer's starter.", 32, 10, ["under-50", "under-25"]],
  ];
  gifts.forEach(([title, description, price, cost, cols, option], i) => {
    add({
      title,
      type: "gift",
      status: title === "Holiday Trio" ? "draft" : "active",
      description,
      tags: ["gift set", ...(cols.includes("fall") ? ["fall"] : [])],
      collections: ["gift-sets", ...cols],
      media: [mediaRef("gift", title), mediaRef("gift", title, 1)],
      option,
      variants: option ? [variant("Warm", `LW-G-DS-W`, price, cost, 20, 14), variant("Fresh", `LW-G-DS-F`, price, cost, 20, 11)] : [variant("Default", `LW-G-${String(i + 1).padStart(2, "0")}`, price, cost, 30 + i * 4, between(4, 18))],
    });
  });
  // Accessories.
  const accessories: [string, string, number, number, number, string?, [string, number][]?][] = [
    ["Wick Trimmer", "Stainless steel, angled so you can reach the bottom of a 14 oz jar. Trim to a quarter inch before every burn.", 18, 5.2, 4, "Finish", [["Brass", 4], ["Black", 16]]],
    ["Candle Snuffer", "A bell snuffer on a long handle. No smoke, no wax splash.", 16, 4.4, 4, "Finish", [["Brass", 12], ["Black", 9]]],
    ["Long Matches", "Fifty 4-inch matches in a glass bottle with a striker on the base.", 10, 2.6, 5, undefined, undefined],
    ["Match Striker", "A ceramic striker dish for strike-anywhere matches.", 14, 3.8, 6, "Finish", [["Sage", 7], ["Terracotta", 13]]],
    ["Candle Lid", "Fits the 8 oz jar. Keeps dust out and the scent in between burns.", 8, 1.9, 3, "Finish", [["Brass", 30], ["Black", 22]]],
    ["Warming Lamp", "Melts the candle from the top with a halogen bulb: no flame, no soot, the same scent.", 65, 24, 38, "Finish", [["Brass", 6], ["Black", 8]]],
    ["Wax Melt Warmer", "A ceramic warmer with a tea light. Holds two cubes.", 24, 7.5, 18, "Finish", [["White", 15], ["Sage", 9], ["Terracotta", 12]]],
    ["Reed Refill Pack", "Ten black reeds. Swap them when you swap the oil.", 6, 1.2, 1, undefined, undefined],
    ["Gift Bag", "A kraft bag with a tissue sheet and a card. Fits any set.", 4, 0.9, 2, undefined, undefined],
    ["Candle Care Kit", "Trimmer, snuffer and a lid in a tin.", 38, 11, 12, undefined, undefined],
    ["Ceramic Tray", "Holds a candle and its lid, catches the drips.", 22, 6.8, 14, "Size", [["Small", 10], ["Large", 7]]],
    ["Storage Tin", "Keeps a 14 oz candle from scuffing in a drawer or a suitcase.", 12, 3.4, 8, undefined, undefined],
    ["Bulb for Warming Lamp", "A replacement halogen bulb, 35 W.", 9, 2.1, 1, undefined, undefined],
    ["Reed Diffuser Cap", "A brass cap for the 100 ml bottle, for travel.", 7, 1.6, 1, undefined, undefined],
    ["Tea Lights", "Twenty unscented soy tea lights for the melt warmer.", 9, 2.4, 6, undefined, undefined],
    ["Scent Card Set", "Twelve blotter cards, one per scent, for the counter or a party.", 6, 1.1, 1, undefined, undefined],
  ];
  accessories.forEach(([title, description, price, cost, weight, option, finishes], i) => {
    const code = `LW-A-${String(i + 1).padStart(2, "0")}`;
    add({
      title,
      type: "accessory",
      status: "active",
      description,
      tags: ["accessory"],
      collections: ["accessories", ...(price < 25 ? ["under-25"] : []), ...(price < 50 ? ["under-50"] : [])],
      media: [mediaRef("accessory", finishes?.[0]?.[0] ?? "natural")],
      option,
      variants: finishes ? finishes.map(([f, stock]) => variant(f, `${code}-${f.slice(0, 2).toUpperCase()}`, price, cost, weight, stock)) : [variant("Default", code, price, cost, weight, between(8, 50))],
    });
  });

  const collections: Collection[] = [
    { id: "candles", title: "Candles", handle: "candles", kind: "automated", rule: "Product type is Candle", description: "Every scent, in three sizes." },
    { id: "diffusers", title: "Reed diffusers", handle: "diffusers", kind: "automated", rule: "Product type is Diffuser", description: "Scent without a flame." },
    { id: "wax-melts", title: "Wax melts", handle: "wax-melts", kind: "automated", rule: "Product type is Wax melt", description: "For the warmer." },
    { id: "gift-sets", title: "Gift sets", handle: "gift-sets", kind: "automated", rule: "Product type is Gift set", description: "Boxed, with a card." },
    { id: "accessories", title: "Accessories", handle: "accessories", kind: "automated", rule: "Product type is Accessory", description: "Trimmers, snuffers, matches and lids." },
    { id: "best-sellers", title: "Best sellers", handle: "best-sellers", kind: "manual", description: "The six things people reorder." },
    { id: "fall", title: "Fall collection", handle: "fall", kind: "manual", description: "Cedar, pine, tobacco and orange. The launch the ads point at." },
    { id: "under-25", title: "Under $25", handle: "under-25", kind: "automated", rule: "Price is less than $25", description: "Small things that still smell like us." },
    { id: "under-50", title: "Gifts under $50", handle: "under-50", kind: "automated", rule: "Tag equals gift set and price is less than $50", description: "Sets and pairs that ship in a box." },
  ];

  const byTitle = (t: string) => products.find((p) => p.title === t)!;
  const amber8 = byTitle("Amber & Oak Candle").variants[1];
  const salt8 = byTitle("Sea Salt & Sage Candle").variants[1];
  // The story: both best sellers sold out for six days ending three days ago, then a delivery landed.
  const outFrom = day(-8);
  const outTo = day(-3);
  amber8.stockouts.push({ from: outFrom, to: outTo });
  salt8.stockouts.push({ from: outFrom, to: outTo });

  /* ---- Campaigns and traffic ---- */
  const campaigns: Campaign[] = [
    { id: "cmp_fall", name: "Fall scents launch", channel: "Meta ads", status: "active", dailyBudget: 60, startedAt: daysFromNow(-41, 9), pauses: [{ from: day(-7), to: day(-3) }] },
    { id: "cmp_brand", name: "Brand search", channel: "Google ads", status: "active", dailyBudget: 20, startedAt: daysFromNow(-300, 9), pauses: [] },
  ];
  const adsPaused = (dayKey: string) => campaigns[0].pauses.some((p) => dayKey >= p.from && dayKey <= p.to);
  const soldOut = (v: Variant, dayKey: string) => v.stockouts.some((s) => dayKey >= s.from && dayKey <= s.to);

  /* ---- Customers ---- */
  const customers: Customer[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < 90; i++) {
    let firstName = pick(FIRST);
    let lastName = pick(LAST);
    while (usedNames.has(`${firstName} ${lastName}`)) (firstName = pick(FIRST)), (lastName = pick(LAST));
    usedNames.add(`${firstName} ${lastName}`);
    const [city, state, zip3] = CITIES[i % CITIES.length];
    const domain = pick(["gmail.com", "gmail.com", "icloud.com", "outlook.com", "hey.com", "proton.me"]);
    customers.push({
      id: nextCustomer(),
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@${domain}`,
      phone: rand() < 0.5 ? `(${between(206, 971)}) 555-0${between(100, 199)}` : undefined,
      subscribed: rand() < 0.62,
      address: { name: `${firstName} ${lastName}`, line1: `${between(100, 4900)} ${pick(STREETS)}`, line2: rand() < 0.2 ? `Apt ${between(1, 40)}` : undefined, city, state, zip: `${zip3}${String(between(1, 99)).padStart(2, "0")}`, country: "United States" },
      createdAt: daysFromNow(-between(0, 400), 11),
      notes: [],
      tags: [],
    });
  }
  const taxRate = (state: string, city: string) => CITIES.find((c) => c[0] === city && c[1] === state)?.[3] ?? 0.07;

  /* ---- Discounts ---- */
  const discounts: Discount[] = [
    { id: "dsc_welcome", title: "WELCOME10", code: "WELCOME10", method: "code", type: "amount_off_order", valueKind: "percentage", value: 10, audience: "new", startsAt: daysFromNow(-300, 0), enabled: true, createdAt: daysFromNow(-300, 10) },
    { id: "dsc_fall", title: "FALL15", code: "FALL15", method: "code", type: "amount_off_products", valueKind: "percentage", value: 15, appliesTo: "candle", audience: "everyone", startsAt: daysFromNow(-41, 0), endsAt: daysFromNow(33, 23, 59), enabled: true, createdAt: daysFromNow(-42, 15) },
    { id: "dsc_ship", title: "Free shipping over $40", method: "automatic", type: "free_shipping", valueKind: "fixed", value: 0, minOrder: 40, audience: "everyone", startsAt: daysFromNow(-120, 0), enabled: true, createdAt: daysFromNow(-120, 10) },
    { id: "dsc_bundle", title: "BUNDLE20", code: "BUNDLE20", method: "code", type: "amount_off_products", valueKind: "percentage", value: 20, appliesTo: "gift", minOrder: 80, audience: "everyone", startsAt: daysFromNow(-60, 0), endsAt: daysFromNow(-5, 23, 59), enabled: true, createdAt: daysFromNow(-61, 11) },
    { id: "dsc_loyal", title: "LOYAL20", code: "LOYAL20", method: "code", type: "amount_off_order", valueKind: "percentage", value: 20, minOrder: 50, audience: "returning", startsAt: daysFromNow(-90, 0), endsAt: daysFromNow(-31, 23, 59), enabled: true, createdAt: daysFromNow(-92, 9), usageLimit: 100 },
    { id: "dsc_bogo", title: "Buy 2 melts, get 1 free", method: "automatic", type: "buy_x_get_y", valueKind: "percentage", value: 100, appliesTo: "melt", audience: "everyone", startsAt: daysFromNow(12, 0), endsAt: daysFromNow(40, 23, 59), enabled: true, createdAt: daysFromNow(-2, 16) },
  ];

  /* ---- Orders: 180 over 90 days, on a curve. ---- */
  const days = Array.from({ length: 90 }, (_, i) => day(i - 89));
  const weight = (dayKey: string, offset: number) => {
    const dow = fromDay(dayKey).getDay();
    let w = dow === 0 || dow === 6 ? 2.7 : 1.7;
    w *= 1 + 0.3 * ((offset + 89) / 89);
    if (dayKey >= outFrom && dayKey <= outTo) w *= 0.62;
    if (adsPaused(dayKey)) w *= 0.78;
    if (offset === 0) w *= 0.45;
    return w * (0.78 + rand() * 0.44);
  };
  const weights = days.map((d, i) => weight(d, i - 89));
  const totalW = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (w / totalW) * 180);
  const counts = exact.map(Math.floor);
  const remainders = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r);
  for (let k = 0; counts.reduce((s, c) => s + c, 0) < 180; k++) counts[remainders[k % remainders.length].i]++;

  const activeVariants = products.filter((p) => p.status === "active").flatMap((p) => p.variants.map((v) => ({ p, v })));
  // A small store's Pareto: a dozen variants carry most of the sales; the two best sellers most of all.
  const POPULAR: Record<string, number> = { "Amber & Oak Candle|8 oz": 22, "Sea Salt & Sage Candle|8 oz": 16, "Fig & Cassis Candle|8 oz": 6, "Cedar Smoke Candle|8 oz": 5, "Lavender Field Candle|8 oz": 4.5, "Amber & Oak Reed Diffuser|100 ml": 4, "Discovery Set|Warm": 4, "Wick Trimmer|Black": 3, "Vanilla Bean Wax Melts|6 cubes": 3, "Fresh Linen Candle|14 oz three-wick": 2.5, "Cedar Smoke Candle|14 oz three-wick": 2, "Sea Salt & Sage Reed Diffuser|100 ml": 2.5 };
  const variantWeight = ({ p, v }: { p: Product; v: Variant }, weekend: boolean) => {
    const popular = POPULAR[`${p.title}|${v.title}`];
    if (popular) return popular;
    if (p.type === "candle") return v.title === "8 oz" ? 1.6 : v.title.startsWith("14") ? 0.7 : 1.0;
    if (p.type === "diffuser") return v.title === "100 ml" ? 1.0 : 0.4;
    if (p.type === "melt") return v.title === "6 cubes" ? 0.9 : 0.4;
    if (p.type === "gift") return weekend ? 1.5 : 0.9;
    return 0.5;
  };
  // Stock after last week's delivery: the runners are low again, a few slow lines are nearly out.
  const setStock = (title: string, variantTitle: string, n: number) => (byTitle(title).variants.find((v) => v.title === variantTitle)!.inventory = n);
  setStock("Amber & Oak Candle", "8 oz", 6);
  setStock("Sea Salt & Sage Candle", "8 oz", 4);
  setStock("Lavender Field Candle", "8 oz", 3);
  setStock("Cedar Smoke Candle", "14 oz three-wick", 2);
  setStock("Fresh Linen Candle", "14 oz three-wick", 2);
  setStock("Amber & Oak Reed Diffuser", "100 ml", 4);
  setStock("Discovery Set", "Warm", 3);
  setStock("Wick Trimmer", "Black", 2);
  setStock("Vanilla Bean Wax Melts", "6 cubes", 1);
  setStock("Fig & Cassis Reed Diffuser", "200 ml refill", 2);
  const chooseVariant = (dayKey: string, weekend: boolean, exclude: Set<string>) => {
    const pool = activeVariants.filter(({ v }) => !exclude.has(v.id) && !soldOut(v, dayKey));
    const total = pool.reduce((s, x) => s + variantWeight(x, weekend), 0);
    let r = rand() * total;
    for (const x of pool) {
      r -= variantWeight(x, weekend);
      if (r <= 0) return x;
    }
    return pool.at(-1)!;
  };
  const shuffled = [...customers].sort(() => rand() - 0.5);
  const loyal = shuffled.slice(0, 26);
  // First orders arrive all through the ninety days, so "new" and "returning" both mean something.
  const fresh = [...shuffled];
  const ordered = new Set<string>();
  const nextCustomerFor = (): Customer => {
    const first = fresh.length && (ordered.size === 0 || rand() < 0.52) ? fresh.shift()! : rand() < 0.55 ? pick(loyal.filter((c) => ordered.has(c.id))) ?? fresh.shift()! : pick([...ordered].map((id) => customers.find((c) => c.id === id)!));
    ordered.add(first.id);
    return first;
  };
  const orders: Order[] = [];
  days.forEach((dayKey, di) => {
    const dow = fromDay(dayKey).getDay();
    const weekend = dow === 0 || dow === 6;
    for (let n = 0; n < counts[di]; n++) {
      // Today's orders sit in the hours already gone, so nothing on Home reads "in 6h".
      const hour = di === 89 ? between(0, Math.max(0, new Date().getHours() - 1)) : between(7, 22);
      const createdAt = at(dayKey, hour, between(0, 59));
      const customer = nextCustomerFor();
      const nItems = rand() < 0.48 ? 1 : rand() < 0.68 ? 2 : 3;
      const chosen = new Set<string>();
      const items: LineItem[] = [];
      for (let k = 0; k < nItems; k++) {
        const { p, v } = chooseVariant(dayKey, weekend, chosen);
        chosen.add(v.id);
        const qty = rand() < 0.86 ? 1 : rand() < 0.8 ? 2 : 3;
        items.push({ id: nextItem(), productId: p.id, variantId: v.id, title: p.title, variantTitle: v.title, sku: v.sku, media: p.media[0], qty, price: v.price, fulfilled: 0, refunded: 0 });
      }
      const subtotal = round2(items.reduce((s, it) => s + it.qty * it.price, 0));
      // A discount code on about a fifth of orders, only ones that were live that day.
      let discountCode: string | undefined;
      let discountAmount = 0;
      if (rand() < 0.22) {
        const live = discounts.filter((d) => d.code && d.enabled && createdAt >= d.startsAt && (!d.endsAt || createdAt <= d.endsAt) && (!d.minOrder || subtotal >= d.minOrder));
        const d = live.length ? pick(live) : undefined;
        if (d) {
          discountCode = d.code;
          const base = d.type === "amount_off_products" ? items.filter((it) => products.find((p) => p.id === it.productId)!.type === d.appliesTo).reduce((s, it) => s + it.qty * it.price, 0) : subtotal;
          discountAmount = round2(d.valueKind === "percentage" ? (base * d.value) / 100 : Math.min(base, d.value));
          if (discountAmount === 0) discountCode = undefined;
        }
      }
      const afterDiscount = round2(subtotal - discountAmount);
      const shipping = afterDiscount >= 40 ? 0 : 6.95;
      const tax = round2(afterDiscount * taxRate(customer.address.state, customer.address.city));
      const total = round2(afterDiscount + shipping + tax);
      const source: Source = adsPaused(dayKey) ? pick(["organic", "organic", "email", "social", "direct"]) : pick(["ads", "ads", "ads", "organic", "organic", "organic", "email", "social", "direct"]);
      const timeline: Event[] = [
        { id: nextEvent(), at: createdAt, kind: "placed", text: `Order placed on the online store${discountCode ? ` with code ${discountCode}` : ""}` },
        { id: nextEvent(), at: addDays(createdAt, 0.002), kind: "paid", text: `Payment of $${total.toFixed(2)} captured (Visa ending ${between(1000, 9999)})` },
      ];
      orders.push({ id: nextOrder(), number: 0, customerId: customer.id, createdAt, promisedShipAt: promisedShip(createdAt), items, subtotal, discountCode, discountAmount, shipping, tax, total, paymentStatus: "paid", fulfillmentStatus: "unfulfilled", status: "open", source, refunds: [], tags: [], timeline, shippingAddress: { ...customer.address }, billingSame: rand() < 0.85 });
    }
  });
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  orders.forEach((o, i) => (o.number = 1001 + i));

  // Fulfilment: everything older than three days has shipped, except five that slipped and are late.
  const ageDays = (o: Order) => (Date.now() - new Date(o.createdAt).getTime()) / 86400000;
  const lateCandidates = orders.filter((o) => ageDays(o) >= 4 && ageDays(o) <= 9 && o.number !== 1042).slice(-5);
  const late = new Set(lateCandidates.map((o) => o.id));
  const partialPick = orders.filter((o) => o.items.length >= 2 && ageDays(o) >= 1 && ageDays(o) <= 2).slice(0, 2);
  const partial = new Set(partialPick.map((o) => o.id));
  const fulfill = (o: Order, when: string, all = true) => {
    const carrier = pick(["USPS", "USPS", "UPS"]);
    o.tracking = `${carrier === "USPS" ? "9400 1000 0000" : "1Z 999 AA1"} ${between(1000, 9999)} ${between(1000, 9999)}`;
    o.fulfilledAt = when;
    for (const it of o.items) it.fulfilled = all ? it.qty : it === o.items[0] ? it.qty : 0;
    o.fulfillmentStatus = all ? "fulfilled" : "partial";
    o.timeline.push({ id: nextEvent(), at: when, kind: "fulfilled", text: `${all ? "All items" : `${o.items[0].qty} of ${o.items.reduce((s, it) => s + it.qty, 0)} items`} fulfilled via ${carrier}, tracking ${o.tracking}` });
    if (all && ageDays(o) > 6) o.timeline.push({ id: nextEvent(), at: addDays(when, between(2, 5) + rand()), kind: "delivered", text: "Delivered" });
  };
  for (const o of orders) {
    const age = ageDays(o);
    if (late.has(o.id)) continue;
    if (partial.has(o.id)) fulfill(o, addDays(o.createdAt, 0.6), false);
    else if (age >= 3 || (age >= 1 && rand() < 0.45)) fulfill(o, addDays(o.createdAt, 0.4 + rand() * 1.4));
    if (o.fulfillmentStatus === "fulfilled" && age > 10) {
      o.status = "archived";
      o.timeline.push({ id: nextEvent(), at: addDays(o.fulfilledAt!, 7), kind: "archived", text: "Order archived" });
    }
    if (age > 2 && rand() < 0.1) o.timeline.push({ id: nextEvent(), at: addDays(o.createdAt, 0.2 + rand()), kind: "comment", text: pick(COMMENTS), author: "Maya Lindqvist" });
  }
  // Payment: three recent orders paid by bank deposit are still pending.
  for (const o of orders.filter((o) => ageDays(o) <= 4 && o.fulfillmentStatus === "unfulfilled" && !late.has(o.id)).slice(0, 3)) {
    o.paymentStatus = "pending";
    o.timeline = o.timeline.filter((e) => e.kind !== "paid");
    o.timeline.push({ id: nextEvent(), at: addDays(o.createdAt, 0.001), kind: "note", text: "Payment pending: bank deposit chosen at checkout" });
  }
  // Refunds: three whole, two partial; #1042 stays clean for the refund ask.
  const refundable = orders.filter((o) => o.status === "archived" && o.number !== 1042 && ageDays(o) > 12);
  const refundReasons = ["Damaged in transit", "Customer changed their mind", "Wrong scent sent"];
  refundable.filter((_, i) => i % 11 === 3).slice(0, 3).forEach((o, i) => {
    const when = addDays(o.fulfilledAt!, between(4, 9));
    o.refunds.push({ id: nextRefund(), at: when, amount: o.total, reason: refundReasons[i], items: o.items.map((it) => ({ lineItemId: it.id, qty: it.qty })), restocked: i !== 0 });
    for (const it of o.items) it.refunded = it.qty;
    o.paymentStatus = "refunded";
    o.timeline.push({ id: nextEvent(), at: when, kind: "refund", text: `Refunded $${o.total.toFixed(2)} to the original payment method: ${refundReasons[i].toLowerCase()}` });
  });
  refundable.filter((o) => o.items.length >= 2 && o.paymentStatus === "paid").filter((_, i) => i % 7 === 2).slice(0, 2).forEach((o) => {
    const it = o.items[o.items.length - 1];
    const amount = round2(it.price * 1 * (1 + taxRate(o.shippingAddress.state, o.shippingAddress.city)));
    const when = addDays(o.fulfilledAt!, between(3, 8));
    o.refunds.push({ id: nextRefund(), at: when, amount, reason: "Arrived cracked", items: [{ lineItemId: it.id, qty: 1 }], restocked: false });
    it.refunded = 1;
    o.paymentStatus = "partially_refunded";
    o.timeline.push({ id: nextEvent(), at: when, kind: "refund", text: `Refunded $${amount.toFixed(2)} for 1 × ${it.title}: arrived cracked` });
  });
  // Canceled: four, before they shipped.
  orders.filter((o) => ageDays(o) > 10 && ageDays(o) < 70 && o.number !== 1042 && o.refunds.length === 0 && o.number % 13 === 5).slice(0, 4).forEach((o, i) => {
    const when = addDays(o.createdAt, 0.3 + rand() * 0.5);
    o.status = "canceled";
    o.canceledAt = when;
    o.cancelReason = i % 2 ? "Customer changed their mind" : "Ordered by mistake";
    o.fulfillmentStatus = "unfulfilled";
    o.fulfilledAt = undefined;
    o.tracking = undefined;
    for (const it of o.items) (it.fulfilled = 0), (it.refunded = it.qty);
    o.timeline = o.timeline.filter((e) => e.kind === "placed" || e.kind === "paid");
    o.refunds.push({ id: nextRefund(), at: when, amount: o.total, reason: o.cancelReason, items: o.items.map((it) => ({ lineItemId: it.id, qty: it.qty })), restocked: true });
    o.paymentStatus = "refunded";
    o.timeline.push({ id: nextEvent(), at: when, kind: "canceled", text: `Order canceled: ${o.cancelReason.toLowerCase()}. $${o.total.toFixed(2)} refunded.` });
  });
  for (const o of orders) o.timeline.sort((a, b) => a.at.localeCompare(b.at));
  // Tags a merchant would have added.
  for (const o of orders) {
    if (o.items.some((it) => products.find((p) => p.id === it.productId)!.type === "gift")) o.tags.push("gift");
    if (o.shippingAddress.state !== "OR" && o.total > 100) o.tags.push("insured");
  }

  /* ---- Traffic: sessions that make the conversion rate about 2.4%, lower while the ads were off. ---- */
  const traffic = days.map((d, i) => {
    const n = counts[i];
    const conv = 0.021 + rand() * 0.007;
    const base = Math.round(Math.max(n, 1) / conv);
    const sessions = Math.round(base * (adsPaused(d) ? 0.72 : 1) * (i === 89 ? 0.45 : 1) + between(-8, 12));
    return { date: d, sessions: Math.max(sessions, n + 5) };
  });

  /* ---- Abandoned checkouts: the last two weeks. ---- */
  const checkouts: Checkout[] = [];
  for (let i = 0; i < 14; i++) {
    const offset = i < 8 ? -between(0, 6) : -between(7, 13);
    const dayKey = day(offset);
    const known = rand() < 0.6 ? pick(customers) : undefined;
    const first = known?.firstName ?? pick(FIRST);
    const last = known?.lastName ?? pick(LAST);
    const chosen = new Set<string>();
    const items: LineItem[] = [];
    for (let k = 0; k < (rand() < 0.55 ? 1 : 2); k++) {
      const { p, v } = chooseVariant(dayKey, false, chosen);
      chosen.add(v.id);
      items.push({ id: nextItem(), productId: p.id, variantId: v.id, title: p.title, variantTitle: v.title, sku: v.sku, media: p.media[0], qty: 1, price: v.price, fulfilled: 0, refunded: 0 });
    }
    const older = offset <= -7;
    const hour = offset === 0 ? between(0, Math.max(0, new Date().getHours() - 1)) : between(8, 23);
    checkouts.push({ id: nextCheckout(), customerId: known?.id, email: known?.email ?? `${first.toLowerCase()}.${last.toLowerCase()}@${pick(["gmail.com", "icloud.com", "outlook.com"])}`, name: `${first} ${last}`, createdAt: at(dayKey, hour, between(0, 59)), items, subtotal: round2(items.reduce((s, it) => s + it.price * it.qty, 0)), emailStatus: older ? (i % 3 === 0 ? "opened" : "sent") : "not_sent", remindedAt: older ? at(day(offset + 1), 10) : undefined });
  }
  checkouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /* ---- Draft orders: wholesale and a phone order. ---- */
  const drafts: DraftOrder[] = [];
  const draft = (customer: Customer, lines: [Product, number, number][], status: DraftOrder["status"], offset: number, note?: string) => {
    const items = lines.map(([p, vi, qty]) => ({ id: nextItem(), productId: p.id, variantId: p.variants[vi].id, title: p.title, variantTitle: p.variants[vi].title, sku: p.variants[vi].sku, media: p.media[0], qty, price: p.variants[vi].price, fulfilled: 0, refunded: 0 }));
    const subtotal = round2(items.reduce((s, it) => s + it.qty * it.price, 0));
    const shipping = subtotal >= 40 ? 0 : 6.95;
    const tax = round2(subtotal * taxRate(customer.address.state, customer.address.city));
    drafts.push({ id: nextDraft(), number: 0, customerId: customer.id, createdAt: daysFromNow(offset, 14), items, subtotal, shipping, tax, total: round2(subtotal + shipping + tax), status, note });
  };
  draft(loyal[0], [[byTitle("Amber & Oak Candle"), 1, 12], [byTitle("Fig & Cassis Candle"), 1, 12]], "invoice_sent", -2, "Wholesale for the shop on Alberta St, 30% off list to be applied on payment.");
  draft(loyal[3], [[byTitle("Housewarming Set"), 0, 1], [byTitle("Long Matches"), 0, 2]], "open", -1, "Phone order; wants it gift wrapped.");
  draft(loyal[5], [[byTitle("Discovery Set"), 0, 3]], "completed", -9);
  drafts.forEach((d, i) => (d.number = 12 + i));

  return {
    shop: {
      name: "Lantern & Wick",
      email: "hello@lanternandwick.com",
      phone: "(503) 555-0148",
      address: { name: "Lantern & Wick", line1: "2210 SE Division St", line2: "Studio B", city: "Portland", state: "OR", zip: "97202", country: "United States" },
      currency: "USD",
      timezone: "America/Los_Angeles",
      owner: { name: "Maya Lindqvist", email: "maya@lanternandwick.com" },
    },
    products,
    collections,
    orders,
    drafts,
    customers,
    discounts,
    checkouts,
    campaigns,
    traffic,
    settings: { appearance: "system" },
  };
}

/* ---- Lookups and derived facts the screens and the surfaces share ---- */

export const product = (h: Quay, id?: string | null) => h.products.find((p) => p.id === id);
export const variantOf = (h: Quay, id?: string | null): { product: Product; variant: Variant } | undefined => {
  for (const p of h.products) for (const v of p.variants) if (v.id === id) return { product: p, variant: v };
  return undefined;
};
export const customer = (h: Quay, id?: string | null) => h.customers.find((c) => c.id === id);
export const order = (h: Quay, id?: string | null) => h.orders.find((o) => o.id === id);
export const orderByNumber = (h: Quay, n: number) => h.orders.find((o) => o.number === n);
export const fullName = (c: Pick<Customer, "firstName" | "lastName">) => `${c.firstName} ${c.lastName}`;
/** "Maya Lindqvist" → "ML". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 2) return words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return (words[0] ?? name).slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}
export const variantLabel = (p: Product, v: Variant) => (p.option ? `${p.title} · ${v.title}` : p.title);
export const stock = (p: Product) => p.variants.reduce((s, v) => s + v.inventory, 0);
export const silhouette = (p: Product): Silhouette => p.type;

export const dayKey = (iso: string) => isoDay(iso);
export const today = () => isoDay(new Date());
export const daysAgo = (n: number) => isoDay(daysFromNow(-n, 12));
export const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

/** Counts toward sales: placed, not canceled. Refunds are subtracted where a figure says "net". */
export const counts = (o: Order) => o.status !== "canceled";
export const refundedTotal = (o: Order) => o.refunds.reduce((s, r) => s + r.amount, 0);
export const netTotal = (o: Order) => round2(o.total - refundedTotal(o));
export const isLate = (o: Order) => o.status === "open" && o.fulfillmentStatus !== "fulfilled" && new Date(o.promisedShipAt).getTime() < Date.now();
export const unfulfilledItems = (o: Order) => o.items.filter((it) => it.fulfilled < it.qty);

/** Orders placed on a local day key range, inclusive, that count. */
export function ordersBetween(h: Quay, from: string, to: string): Order[] {
  return h.orders.filter((o) => counts(o) && dayKey(o.createdAt) >= from && dayKey(o.createdAt) <= to);
}
export interface DayPoint { date: string; revenue: number; orders: number; sessions: number }
/** One point per day, from the orders themselves, so every chart agrees with the orders index. */
export function daily(h: Quay, from: string, to: string): DayPoint[] {
  const out: DayPoint[] = [];
  const cur = fromDay(from);
  const end = fromDay(to);
  while (cur.getTime() <= end.getTime()) {
    const d = isoDay(cur);
    const os = h.orders.filter((o) => counts(o) && dayKey(o.createdAt) === d);
    out.push({ date: d, revenue: round2(os.reduce((s, o) => s + o.total, 0)), orders: os.length, sessions: h.traffic.find((t) => t.date === d)?.sessions ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
export interface Summary { sales: number; orders: number; sessions: number; conversion: number; aov: number; returningRate: number; items: number; net: number }
export function summarize(h: Quay, from: string, to: string): Summary {
  const os = ordersBetween(h, from, to);
  const sales = round2(os.reduce((s, o) => s + o.total, 0));
  const net = round2(os.reduce((s, o) => s + netTotal(o), 0));
  const sessions = h.traffic.filter((t) => t.date >= from && t.date <= to).reduce((s, t) => s + t.sessions, 0);
  const returning = os.filter((o) => h.orders.some((p) => p.customerId === o.customerId && p.createdAt < o.createdAt && counts(p))).length;
  return { sales, net, orders: os.length, sessions, conversion: sessions ? os.length / sessions : 0, aov: os.length ? round2(sales / os.length) : 0, returningRate: os.length ? returning / os.length : 0, items: os.reduce((s, o) => s + o.items.reduce((t, it) => t + it.qty, 0), 0) };
}
/** Units of a variant sold on days in a range that count. */
export function unitsSold(h: Quay, variantId: string, from: string, to: string): number {
  return ordersBetween(h, from, to).reduce((s, o) => s + o.items.filter((it) => it.variantId === variantId).reduce((t, it) => t + it.qty, 0), 0);
}
export function revenueOf(h: Quay, variantId: string, from: string, to: string): number {
  return round2(ordersBetween(h, from, to).reduce((s, o) => s + o.items.filter((it) => it.variantId === variantId).reduce((t, it) => t + it.qty * it.price, 0), 0));
}
/** Days a variant was sellable in a range, so a stock-out doesn't drag its velocity down. */
export function daysInStock(v: Variant, from: string, to: string): number {
  let n = 0;
  const cur = fromDay(from);
  const end = fromDay(to);
  while (cur.getTime() <= end.getTime()) {
    const d = isoDay(cur);
    if (!v.stockouts.some((s) => d >= s.from && d <= s.to)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
export interface Cover { product: Product; variant: Variant; perDay: number; days: number | null; sold30: number }
/** Days of cover from the last 30 days' velocity; null when nothing sold. */
export function cover(h: Quay, p: Product, v: Variant): Cover {
  const from = daysAgo(30);
  const to = daysAgo(1);
  const sold30 = unitsSold(h, v.id, from, to);
  const perDay = sold30 / Math.max(1, daysInStock(v, from, to));
  return { product: p, variant: v, perDay, days: perDay > 0 ? Math.floor(v.inventory / perDay) : null, sold30 };
}
export const covers = (h: Quay) => h.products.filter((p) => p.status !== "archived").flatMap((p) => p.variants.filter((v) => v.trackQuantity).map((v) => cover(h, p, v)));

export interface CustomerStats { orders: number; spent: number; last?: string; first?: string; returning: boolean }
export function customerStats(h: Quay, id: string): CustomerStats {
  const os = h.orders.filter((o) => o.customerId === id && counts(o)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { orders: os.length, spent: round2(os.reduce((s, o) => s + netTotal(o), 0)), last: os.at(-1)?.createdAt, first: os[0]?.createdAt, returning: os.length >= 2 };
}
export const discountUses = (h: Quay, d: Discount) => (d.code ? h.orders.filter((o) => o.discountCode === d.code && counts(o)) : []);
export type DiscountState = "active" | "scheduled" | "expired" | "disabled";
export function discountState(d: Discount, now = Date.now()): DiscountState {
  if (!d.enabled) return "disabled";
  if (new Date(d.startsAt).getTime() > now) return "scheduled";
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return "expired";
  return "active";
}
export function discountSummary(d: Discount): string {
  const amount = d.type === "free_shipping" ? "Free shipping" : d.type === "buy_x_get_y" ? `Buy 2 ${d.appliesTo ? TYPE_LABEL[d.appliesTo].toLowerCase() : "items"}, get 1 free` : `${d.valueKind === "percentage" ? `${d.value}%` : `$${d.value.toFixed(2)}`} off ${d.type === "amount_off_products" ? `${d.appliesTo ? TYPE_LABEL[d.appliesTo].toLowerCase() : "product"}s` : "the order"}`;
  const min = d.minOrder ? ` · Minimum purchase of $${d.minOrder.toFixed(2)}` : "";
  const who = d.audience === "everyone" ? "" : ` · ${AUDIENCE_LABEL[d.audience]}`;
  return `${amount}${min}${who}`;
}
/** Which customers a discount audience reaches, from their order history. */
export function audienceOf(h: Quay, a: Audience): Customer[] {
  return h.customers.filter((c) => {
    const s = customerStats(h, c.id);
    if (a === "everyone") return true;
    if (a === "returning") return s.orders >= 2;
    if (a === "new") return s.orders <= 1;
    return !s.last || daysUntil(s.last) <= -60;
  });
}
export const campaignPausedOn = (c: Campaign, d: string) => c.pauses.some((p) => d >= p.from && d <= p.to);
export const me = (h: Quay) => h.shop.owner;
