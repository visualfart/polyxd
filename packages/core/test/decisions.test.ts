import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planChoice, optionKey, partitionRecent, toggleSelection, isSelected, idOf, optionsOf, ROOT_SCOPE,
  frameWidth, placementFor, appBarTitle, documentTitle,
  stackedColumns, isNumericColumn, paging, nextSort, columnCount, rowValue,
  skeletonShape, SKELETON_SHAPES, skeletonStatus,
  parseShortcut, shortcutMatches, unmodified, isApplePlatform,
  fitActions, minShown, menuOrder,
  collectionLayout, orderedIndices, moveItem, calendarMonth, dateParts, monthToShow, shiftMonth, nearestSlide,
  bestPerAttribute, groupAttributes, recommendedFirst, groupItems, navigationLabel,
  metricChange, meterHint, gaugeState, starsLabel, ratingSaid, maskSecret, groupSummary, avatarTone, initialsOf,
  richText, applyMask, numericValue, storedText, addTag, parseColor, formatColor, toHex6, sameColor, formatBytes, refuseFile, fileLimits,
  niceMax, axisLabel, treemap, verticalScale, qrEncode, treeRows, treeKey, typeAheadTarget, visibleWindow, activeFilters, resultCountText,
  type Option, type Node,
} from "../src/index.ts";

const opts = (n: number, extra: Partial<Option> = {}): Option[] => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Option ${i}`, ...extra }));

test("choice: a few short options are chips, faces are a people picker, the rest a list, searchable past 10", () => {
  assert.equal(planChoice(opts(3), undefined).control, "chips");
  assert.equal(planChoice(opts(6), undefined).control, "chips");
  assert.equal(planChoice(opts(7), undefined).control, "list");
  assert.equal(planChoice(opts(3, { description: "more" }), undefined).control, "list", "a description needs a list");
  assert.equal(planChoice(opts(2, { label: "A label that is far too long for a chip to carry" }), undefined).control, "list");
  assert.equal(planChoice(opts(4, { avatar: "" }), undefined).control, "people");
  assert.equal(planChoice(opts(10), undefined).searchable, false);
  assert.equal(planChoice(opts(11), undefined).searchable, true);
  assert.equal(planChoice(opts(7, { avatar: "" }), undefined).searchable, true, "faces are searchable past six");
  assert.equal(planChoice(opts(3), "multiple").multiple, true);
});

test("choice values compare by JSON; selections toggle; ids are safe", () => {
  assert.equal(optionKey("p_tom"), '"p_tom"');
  assert.notEqual(optionKey(1), optionKey("1"));
  assert.deepEqual(toggleSelection(undefined, "a"), ["a"]);
  assert.deepEqual(toggleSelection(["a", "b"], "a"), ["b"]);
  assert.ok(isSelected(["a"], "a"));
  assert.ok(isSelected("a", "a"));
  assert.ok(!isSelected(null, "a"));
  assert.equal(idOf("x", "p_tom"), "x-_22p_tom_22");
  const { recent, rest } = partitionRecent([{ value: 1, label: "Ann", recent: true }, { value: 2, label: "Bob" }], "");
  assert.equal(recent.length, 1);
  assert.equal(rest.length, 1);
  assert.equal(partitionRecent([{ value: 1, label: "Ann", recent: true }, { value: 2, label: "Bob" }], "bo").rest[0].label, "Bob");
});

test("options come from literals or host data, with descriptions, faces and recency", () => {
  const literal = optionsOf({ id: "c", component: "Choice", options: [{ value: "a", label: "A", description: "d" }] }, {}, ROOT_SCOPE, String);
  assert.deepEqual(literal, [{ value: "a", label: "A", description: "d" }]);
  const bound = optionsOf({ id: "c", component: "Choice", options: { path: "/people", valuePath: "id", labelPath: "name", avatarPath: "photo", recentPath: "recent" } }, { people: [{ id: "p1", name: "Ann", photo: "img-1", recent: true }] }, ROOT_SCOPE, String);
  assert.deepEqual(bound, [{ value: "p1", label: "Ann", description: undefined, avatar: "img-1", recent: true }]);
});

test("frame: width classes and the navigation's placement per width and preference", () => {
  assert.equal(frameWidth(1100), "wide");
  assert.equal(frameWidth(1024), "wide");
  assert.equal(frameWidth(700), "medium");
  assert.equal(frameWidth(390), "compact");
  assert.equal(placementFor(undefined, "wide", 4), "side");
  assert.equal(placementFor(undefined, "medium", 4), "rail");
  assert.equal(placementFor(undefined, "compact", 4), "bar");
  assert.equal(placementFor(undefined, "compact", 6), "drawer", "six items don't fit a bar");
  assert.equal(placementFor("side", "medium", 4), "side");
  assert.equal(placementFor("rail", "wide", 4), "rail");
  assert.equal(placementFor("side", "compact", 4), "bar", "a side column still collapses on compact");
  assert.equal(placementFor("bar", "wide", 4), "bar");
  assert.equal(placementFor("bar", "wide", 9), "drawer");
  assert.equal(placementFor("drawer", "wide", 2), "drawer");
  assert.equal(appBarTitle("Halden", true, "Payments"), "Payments");
  assert.equal(appBarTitle("Halden", false, "Payments"), "Halden");
  assert.equal(documentTitle("Halden", "Payments"), "Payments · Halden");
  assert.equal(documentTitle("Halden"), "Halden");
});

test("table: numeric columns, stacked rows, paging and sorting", () => {
  assert.ok(isNumericColumn({ format: { type: "currency" } }));
  assert.ok(isNumericColumn({ align: "end" }));
  assert.ok(!isNumericColumn({ format: { type: "currency" }, align: "start" }));
  const cols = [{ key: "n" }, { key: "s", kind: "status" }, { key: "a" }, { key: "b" }, { key: "c" }, { key: "d" }];
  const s = stackedColumns(cols);
  assert.equal(s.first.key, "n");
  assert.equal(s.status?.key, "s");
  assert.deepEqual(s.details.map((c) => c.key), ["a", "b", "c"]);
  const p = paging(2, 25, 60, 25);
  assert.deepEqual([p.pages, p.from, p.to], [3, 26, 50]);
  assert.deepEqual(p.sizes, [10, 25, 50, 100]);
  assert.equal(paging(undefined, undefined, undefined, 7).pages, 1);
  assert.equal(paging(1, 7, 0, 7).from, 0);
  assert.equal(nextSort("a", "a", "ascending"), "descending");
  assert.equal(nextSort("a", "b", "descending"), "ascending");
  const node: Node = { id: "t", component: "Table", columns: cols, rowActions: "m" };
  assert.equal(columnCount(node, true, true), 9);
  assert.equal(rowValue(node, [{ id: "r1" }], 0, {}, { pointer: "/rows/0" }), "r1");
  assert.equal(rowValue(node, [{}], 0, {}, { pointer: "/rows/0" }), 0);
  assert.equal(rowValue({ ...node, rowValuePath: "sku" }, [{}], 0, { rows: [{ sku: "S" }] }, { pointer: "/rows/0" }), "S");
});

test("skeleton: patterns pick shapes, an explicit shape wins, the silhouettes hold the right blocks", () => {
  assert.equal(skeletonShape("compare-and-choose"), "compare");
  assert.equal(skeletonShape("compare-and-choose", "dialog"), "dialog");
  assert.equal(skeletonShape(), "detail");
  const count = (parts: any[], block: string): number => parts.reduce((n, p) => n + (p.block === block ? 1 : p.parts ? count(p.parts, block) : 0), 0);
  assert.equal(count(SKELETON_SHAPES.list, "square"), 5);
  assert.equal(count(SKELETON_SHAPES.form, "field"), 4);
  assert.equal(count(SKELETON_SHAPES.compare, "line"), 3);
  assert.equal(skeletonStatus("Flights"), "Preparing Flights");
  assert.equal(skeletonStatus(), "Preparing");
});

test("shortcuts parse per platform and match key events", () => {
  const mac = parseShortcut("mod+shift+d", true);
  assert.deepEqual(mac.hint, ["⌘", "⇧", "D"]);
  assert.equal(mac.aria, "Meta+Shift+D");
  const pc = parseShortcut("mod+enter", false);
  assert.deepEqual(pc.hint, ["Ctrl", "Enter"]);
  assert.equal(pc.aria, "Control+Enter");
  const base = { key: "", code: "", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
  assert.ok(shortcutMatches(pc, { ...base, key: "Enter", code: "Enter", ctrlKey: true }));
  assert.ok(!shortcutMatches(pc, { ...base, key: "Enter", code: "Enter" }), "the modifier is required");
  assert.ok(!shortcutMatches(pc, { ...base, key: "Enter", code: "Enter", ctrlKey: true, shiftKey: true }), "no extra modifiers");
  const alt = parseShortcut("alt+k", true);
  assert.ok(shortcutMatches(alt, { ...base, key: "˚", code: "KeyK", altKey: true }), "Alt on a Mac matches by physical key");
  assert.ok(unmodified(parseShortcut("slash", false)));
  assert.ok(unmodified(parseShortcut("shift+slash", false)));
  assert.ok(!unmodified(pc));
  assert.ok(isApplePlatform("MacIntel"));
  assert.ok(!isApplePlatform("Win32"));
});

test("action bars fold least-important actions first and never the first; menus put danger last", () => {
  const ids = ["a", "b", "c", "d"];
  const width = () => 100;
  assert.equal(fitActions(ids, width, 8, 1000, 44, 1), 4);
  assert.equal(fitActions(ids, width, 8, 300, 44, 1), 2, "two fit, then the trigger");
  assert.equal(fitActions(ids, width, 8, 120, 44, 1), 1, "the first never folds");
  assert.equal(fitActions(["a", "b"], width, 8, 10, 44, 1), 2, "two actions never fold");
  const byId = new Map<string, Node>([["a", { id: "a", component: "Action" }], ["b", { id: "b", component: "ActionMenu" }], ["c", { id: "c", component: "Action" }]]);
  assert.equal(minShown(["a", "b", "c"], byId), 2);
  assert.equal(minShown(["a", "c"], byId), 1);
  const order = menuOrder([{ id: "x", component: "Action", tone: "danger" }, { id: "y", component: "Action" }]);
  assert.deepEqual(order.usual.map((a) => a.id), ["y"]);
  assert.deepEqual(order.danger.map((a) => a.id), ["x"]);
  assert.ok(order.divider);
});

test("collections: layout, people's order, moves, and the calendar month", () => {
  assert.ok(collectionLayout({ id: "c", component: "Collection" }, { id: "t", component: "Card", media: "m" }).grid);
  assert.ok(!collectionLayout({ id: "c", component: "Collection", layout: "list" }, { id: "t", component: "Card", media: "m" }).grid);
  assert.ok(collectionLayout({ id: "c", component: "Collection", layout: "calendar" }, undefined).calendar);
  assert.deepEqual(orderedIndices(["a", "b", "c"], ["c", "a"]), [2, 0, 1]);
  assert.deepEqual(orderedIndices(["a", "b"], undefined), [0, 1]);
  assert.deepEqual(moveItem([0, 1, 2], ["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.equal(moveItem([0, 1], ["a", "b"], 0, 5), undefined);
  assert.deepEqual(dateParts("2026-02-10T00:00:00Z"), { y: 2026, m: 1, d: 10 });
  assert.equal(dateParts("nope"), undefined);
  const m = calendarMonth({ y: 2026, m: 1 }, "en-GB");
  assert.equal(m.monthName, "February 2026");
  assert.deepEqual(m.weekdays, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.equal(m.weeks.length, 5);
  assert.deepEqual(m.weeks[0], [null, null, null, null, null, null, 1], "1 Feb 2026 is a Sunday");
  assert.deepEqual(monthToShow(null, { y: 2025, m: 3 }), { y: 2025, m: 3 });
  assert.deepEqual(shiftMonth({ y: 2026, m: 11 }, 1), { y: 2027, m: 0 });
  assert.equal(nearestSlide([0, 300, 600], 280), 1);
});

test("comparison and navigation grouping", () => {
  const at = (path: string, i: number) => [{ price: 10, seats: 5 }, { price: 8, seats: 5 }][i][path as "price" | "seats"];
  const best = bestPerAttribute([{ key: "price", path: "price", better: "lower" }, { key: "seats", path: "seats", better: "higher" }], 2, at);
  assert.equal(best.get("price"), 1);
  assert.equal(best.has("seats"), false, "a tie is nobody's best");
  const groups = groupAttributes([{ key: "a", group: "Cost" }, { key: "b" }, { key: "c", group: "Cost" }], String);
  assert.deepEqual(groups.map((g) => [g.label, g.attributes.length]), [["Cost", 2], [undefined, 1]]);
  assert.deepEqual(recommendedFirst(["Basic", "Pro", "Team"], "Team"), [2, 0, 1]);
  assert.deepEqual(recommendedFirst(["Basic", "Pro"], undefined), [0, 1]);
  assert.deepEqual(groupItems([{ key: "a", group: "G" }, { key: "b" }], String).map((g) => g.items.length), [1, 1]);
  assert.equal(navigationLabel("toc"), "On this page");
  assert.equal(navigationLabel("main"), "Main");
});

test("marks: metric change, meters, ratings, secrets, groups, avatars", () => {
  assert.deepEqual(metricChange(-0.08, "increase", { type: "percent", precision: 0 }, "en-GB"), { text: "▼ 8%", spoken: "down 8%", tone: "negative" });
  assert.equal(metricChange(0.08, "decrease", { type: "percent" }, "en-GB")?.tone, "negative");
  assert.equal(metricChange(0, "increase", undefined, "en-GB")?.spoken, "unchanged");
  assert.equal(metricChange("x", undefined, undefined, "en-GB"), undefined);
  assert.deepEqual(meterHint(0.95, { warning: 0.8, danger: 0.9 }), { tone: "danger", hint: "nearly full" });
  assert.deepEqual(meterHint(1.2, undefined), { tone: "danger", hint: "full" });
  assert.deepEqual(meterHint(0.5, { warning: 0.8 }), {});
  const g = gaugeState({ kind: "meter", thresholds: { warning: 0.8 } }, 85, 100, false, "of 100 GB", "en-GB");
  assert.equal(g.percent, 85);
  assert.equal(g.tone, "warning");
  assert.equal(g.valueProps["aria-valuemax"], 100);
  assert.equal(g.valuetext, "85%, of 100 GB, getting full");
  assert.deepEqual(gaugeState({}, 0.3, undefined, true, undefined, "en-GB").valueProps, { "aria-busy": true });
  assert.equal(starsLabel(1), "1 star");
  assert.equal(ratingSaid("4.6", 5), "4.6 out of 5");
  assert.equal(ratingSaid(undefined, 5), "not yet rated");
  assert.equal(maskSecret("ab cd"), "•• ••");
  assert.equal(groupSummary([{ name: "Ann Lee" }, { name: "Bob" }, { name: "Cy" }], 2), "Ann, Bob and 1 more");
  assert.equal(avatarTone("Maya"), avatarTone("Maya"));
  assert.equal(initialsOf("", "Maya Okafor"), "MO");
  assert.equal(initialsOf("ab", "Maya Okafor"), "AB");
});

test("rich text tokens, masks, numeric fields, tags", () => {
  assert.deepEqual(richText("a **b** `c` [d](/e) [f](javascript:x) *g*"), [
    "a ", { kind: "strong", children: ["b"] }, " ", { kind: "code", text: "c" }, " ", { kind: "link", href: "/e", children: ["d"] }, " ", { kind: "link", href: undefined, children: ["f"] }, " ", { kind: "em", children: ["g"] },
  ]);
  assert.deepEqual(richText("<b>x</b>"), ["<b>x</b>"], "tags are text");
  assert.equal(applyMask("## / ##", "1234"), "12 / 34");
  assert.equal(applyMask("AA-##", "ab12"), "AB-12".replace("AB", "ab"));
  assert.equal(applyMask("## / ##", "12 /", true), "12");
  assert.equal(numericValue("£1,200.50"), 1200.5);
  assert.equal(numericValue(""), null);
  assert.equal(numericValue("abc"), 0, "letters strip to nothing, which is zero (a field that is not a number is validated, not cleared)");
  assert.equal(storedText(40, "currency"), "40.00");
  assert.equal(storedText(null, "number"), "");
  assert.deepEqual(addTag(["a"], " b, "), ["a", "b"]);
  assert.deepEqual(addTag(["a"], "a"), ["a"]);
});

test("colours parse and format in each syntax", () => {
  assert.deepEqual(parseColor("#f80"), { r: 255, g: 136, b: 0, a: 1 });
  assert.deepEqual(parseColor("rgba(1, 2, 3, 0.5)"), { r: 1, g: 2, b: 3, a: 0.5 });
  assert.equal(parseColor("hsl(0, 100%, 50%)")?.r, 255);
  assert.equal(parseColor("blue"), null);
  assert.equal(formatColor({ r: 255, g: 136, b: 0, a: 1 }, "hex", false), "#ff8800");
  assert.equal(formatColor({ r: 255, g: 136, b: 0, a: 0.5 }, "rgb", true), "rgba(255, 136, 0, 0.5)");
  assert.equal(formatColor({ r: 255, g: 0, b: 0, a: 1 }, "hsl", false), "hsl(0, 100%, 50%)");
  assert.equal(toHex6(null), "#000000");
  assert.ok(sameColor(parseColor("#FFF"), parseColor("rgb(255, 255, 255)"), false));
});

test("file limits are said in words; refusals name the file", () => {
  assert.equal(formatBytes(1536, "en-GB"), "1.5 kB");
  assert.equal(fileLimits([".pdf", "image/*"], 5 * 1024 * 1024, true, "en-GB"), "Accepts PDF or images. Up to 5 MB each.");
  assert.equal(refuseFile({ name: "a.exe", size: 1, type: "application/x-msdownload" }, [".pdf"], undefined, "en-GB"), "a.exe isn't an accepted type (PDF).");
  assert.match(refuseFile({ name: "a.pdf", size: 10 * 1024 * 1024, type: "application/pdf" }, [".pdf"], 1024, "en-GB")!, /the limit is 1 kB/);
  assert.equal(refuseFile({ name: "a.pdf", size: 1, type: "application/pdf" }, [".pdf"], undefined, "en-GB"), undefined);
});

test("chart geometry and QR encoding are deterministic", () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(73), 80);
  assert.equal(niceMax(1200), 2000);
  assert.equal(axisLabel("2026-04-01T00:00:00Z", "date", "en-GB"), "Apr");
  assert.equal(axisLabel("2026-04-03T00:00:00Z", "date", "en-GB"), "3 Apr");
  assert.equal(axisLabel("a very long label indeed", undefined, "en-GB"), "a very long ");
  const rects = treemap([3, 1, 0], 600, 240);
  assert.equal(rects[2], null);
  assert.ok(Math.abs(rects[0]!.w * rects[0]!.h - 0.75 * 600 * 240) < 1);
  assert.deepEqual(verticalScale([10, 20], false), { lo: 0, max: 20, ticks: [0, 10, 20] });
  assert.equal(verticalScale([100, 110], true).lo, 98);
  const grid = qrEncode("https://polyxd.com")!;
  assert.equal(grid.length, 25, "18 bytes need version 2");
  assert.ok(grid[0][0] && grid[0][6] && !grid[0][7], "a finder pattern");
  assert.equal(qrEncode("x".repeat(300)), undefined, "too long for version 10");
});

test("tree rows flatten the open hierarchy; keys move by the APG rules; type-ahead finds labels", () => {
  const node: Node = { id: "t", component: "Tree", items: { path: "/items" }, labelPath: "name", childrenPath: "kids" };
  const data = { items: [{ name: "Docs", kids: [{ name: "Draft", kids: [] }] }, { name: "Pics", kids: [] }] };
  const { rows } = treeRows(node, data, ROOT_SCOPE, null);
  assert.deepEqual(rows.map((r) => [r.label, r.level, r.expanded, r.parent]), [["Docs", 1, true, -1], ["Draft", 2, false, 0], ["Pics", 1, false, -1]]);
  assert.equal(treeRows(node, data, ROOT_SCOPE, new Set()).rows.length, 2, "nothing open");
  assert.deepEqual(treeKey(rows, 0, { key: "ArrowLeft", ctrlKey: false, metaKey: false, altKey: false }), { toggle: true });
  assert.deepEqual(treeKey(rows, 1, { key: "ArrowLeft", ctrlKey: false, metaKey: false, altKey: false }), { focus: 0 });
  assert.deepEqual(treeKey(rows, 2, { key: "ArrowDown", ctrlKey: false, metaKey: false, altKey: false }), { focus: 2 });
  assert.deepEqual(treeKey(rows, 0, { key: "p", ctrlKey: false, metaKey: false, altKey: false }), { typeAhead: "p" });
  assert.equal(typeAheadTarget(rows, 0, "p"), 2);
  assert.equal(typeAheadTarget(rows, 2, "d"), 0);
  assert.deepEqual(visibleWindow(50, 0, 40, 400), { start: 0, end: 50 });
  assert.deepEqual(visibleWindow(1000, 4000, 40, 400), { start: 90, end: 120 });
});

test("active filters read each input's value and know what clears it", () => {
  const filters: Node[] = [
    { id: "cat", component: "Choice", label: "Category", value: { path: "/f/cat" }, options: [{ value: "a", label: "Audio" }] },
    { id: "price", component: "RangeInput", label: "Price", mode: "range", min: 0, max: 100, value: { path: "/f/price" }, format: { type: "currency", currency: "GBP" } },
    { id: "stock", component: "Toggle", label: "In stock", value: { path: "/f/stock" } },
    { id: "q", component: "TextInput", label: "Brand", value: { path: "/f/brand" } },
  ];
  const active = activeFilters(filters, { f: { cat: ["a"], price: [10, 100], stock: true, brand: " " } }, ROOT_SCOPE, "en-GB", String);
  assert.deepEqual(active.map((a) => a.label), ["Audio", "Price: £10.00 – £100.00", "In stock"]);
  assert.deepEqual(active[0].cleared, []);
  assert.deepEqual(active[1].cleared, [0, 100]);
  assert.equal(resultCountText(1, "en-GB"), "1 result");
  assert.equal(resultCountText(1200, "en-GB"), "1,200 results");
  assert.equal(resultCountText(undefined, "en-GB"), undefined);
});
