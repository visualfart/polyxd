import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CATEGORY, TYPES, TYPE_LABEL, VENDOR, cover, covers, stock, type Product as ProductT, type ProductStatus, type ProductType, type Variant } from "../seed.ts";
import { mediaRef, resolveMedia } from "../media.ts";
import { useQuay } from "../session.ts";
import { Badge, Button, Card, CardSection, Checkbox, Empty, Field, Icon, IndexTable, Modal, Page, SearchBox, Select, Tabs, Tag, Thumb, money, percent, plural, shortDate, type Column } from "../ui.tsx";

const STATUS_TONE: Record<ProductStatus, "success" | "info" | "neutral"> = { active: "success", draft: "info", archived: "neutral" };
const STATUS_LABEL: Record<ProductStatus, string> = { active: "Active", draft: "Draft", archived: "Archived" };
const VIEWS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "archived", label: "Archived" },
  { id: "low", label: "Low stock" },
];
export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
function inventoryText(p: ProductT) {
  const total = stock(p);
  const n = p.variants.length;
  if (p.variants.some((v) => !v.trackQuantity)) return <span className="q-muted">Inventory not tracked</span>;
  const zero = p.variants.filter((v) => v.inventory === 0).length;
  return (
    <span className={total === 0 ? "q-tone-danger" : zero ? "q-tone-warning" : undefined}>
      {total === 0 ? "0 in stock" : `${total} in stock`}
      {n > 1 ? ` for ${plural(n, "variant")}` : ""}
      {zero && total > 0 ? ` · ${zero} out` : ""}
    </span>
  );
}

export function Products() {
  const { h, open, store, say } = useQuay();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") ?? "all";
  const q = params.get("q") ?? "";
  const typeF = params.get("type") ?? "";
  const collF = params.get("collection") ?? "";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const set = (k: string, v: string) =>
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });
  const lowIds = useMemo(() => new Set(covers(h).filter((c) => c.variant.inventory === 0 || (c.days !== null && c.days <= 14)).map((c) => c.product.id)), [h]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return h.products
      .filter((p) => (view === "low" ? lowIds.has(p.id) && p.status === "active" : view === "all" ? true : p.status === view))
      .filter((p) => !typeF || p.type === typeF)
      .filter((p) => !collF || p.collections.includes(collF))
      .filter((p) => !needle || p.title.toLowerCase().includes(needle) || p.tags.some((t) => t.includes(needle)) || p.variants.some((v) => v.sku.toLowerCase().includes(needle)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [h, view, q, typeF, collF, lowIds]);
  const counts = { all: h.products.length, active: h.products.filter((p) => p.status === "active").length, draft: h.products.filter((p) => p.status === "draft").length, archived: h.products.filter((p) => p.status === "archived").length, low: h.products.filter((p) => p.status === "active" && lowIds.has(p.id)).length };
  const columns: Column<ProductT>[] = [
    { key: "title", label: "Product", sort: (p) => p.title, render: (p) => (
        <span className="q-entity">
          <Thumb media={p.media[0]} size={36} />
          <span className="q-entity-text">
            <span className="q-entity-name">{p.title}</span>
            {lowIds.has(p.id) && p.status === "active" && <span className="q-entity-sub q-tone-warning">Selling out</span>}
          </span>
        </span>
      ) },
    { key: "status", label: "Status", sort: (p) => p.status, render: (p) => <StatusBadge status={p.status} /> },
    { key: "inventory", label: "Inventory", sort: (p) => stock(p), render: (p) => inventoryText(p) },
    { key: "type", label: "Type", sort: (p) => p.type, render: (p) => TYPE_LABEL[p.type], secondary: true },
    { key: "vendor", label: "Vendor", render: (p) => p.vendor, secondary: true },
  ];
  const setStatus = (status: ProductStatus) => {
    const ids = [...selected];
    const undo = store.commit(`Set ${status}`, (d) => {
      for (const p of d.products) if (ids.includes(p.id)) p.status = status;
    });
    say(`${plural(ids.length, "product")} set as ${STATUS_LABEL[status].toLowerCase()}.`, undo);
    setSelected(new Set());
  };
  const filtered = Boolean(q || typeF || collF);
  const clear = () => setParams((p) => (["q", "type", "collection"].forEach((k) => p.delete(k)), p));
  return (
    <Page title="Products" fullWidth secondary={<Button icon="spark" onClick={() => open("inventory.low", { days: 14 })}>What's about to sell out?</Button>} actions={<Button variant="primary" to="/products/new">Add product</Button>}>
      <Card padded={false}>
        <Tabs label="Saved views" items={VIEWS.map((v) => ({ ...v, count: counts[v.id as keyof typeof counts] }))} value={view} onChange={(v) => set("view", v === "all" ? "" : v)} />
        <div className="q-toolbar">
          <SearchBox value={q} onChange={(v) => set("q", v)} placeholder="Search products, SKUs, tags" label="Search products" />
          <Select slim label="Product type" value={typeF} onChange={(v) => set("type", v)} options={[{ value: "", label: "Product type" }, ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]} />
          <Select slim label="Collection" value={collF} onChange={(v) => set("collection", v)} options={[{ value: "", label: "Collection" }, ...h.collections.map((c) => ({ value: c.id, label: c.title }))]} />
          {filtered && (
            <Button variant="tertiary" size="slim" onClick={clear}>
              Clear all
            </Button>
          )}
          <span className="q-spacer" />
          <span className="q-small q-muted">{plural(rows.length, "product")}</span>
        </div>
        <IndexTable
          rows={rows}
          columns={columns}
          rowKey={(p) => p.id}
          rowName={(p) => p.title}
          href={(p) => `/products/${p.id}`}
          caption="Products"
          selectable
          selected={selected}
          onSelect={setSelected}
          bulk={
            <>
              <Button size="slim" onClick={() => setStatus("active")}>
                Set as active
              </Button>
              <Button size="slim" onClick={() => setStatus("draft")}>
                Set as draft
              </Button>
              <Button size="slim" icon="archive" onClick={() => setStatus("archived")}>
                Archive
              </Button>
            </>
          }
          empty={<Empty icon="products" title="No products match" body={view === "low" ? "Nothing sells out within two weeks at the current rate." : filtered ? "Fewer words, or clear a filter." : "Add a product to start selling."} action={filtered ? <Button size="slim" onClick={clear}>Clear filters</Button> : undefined} />}
        />
      </Card>
    </Page>
  );
}

/* ---- One product: the editor, with a contextual save bar while it's dirty. ---- */

const blank = (): ProductT => ({ id: "new", title: "", handle: "", type: "candle", status: "draft", description: "", vendor: VENDOR, category: CATEGORY.candle, tags: [], collections: [], media: [], variants: [{ id: `var_${Date.now().toString(36)}`, title: "Default", sku: "", price: 0, cost: 0, weight: 8, trackQuantity: true, inventory: 0, stockouts: [] }], createdAt: new Date().toISOString() });

export function Product() {
  const { id } = useParams();
  const { h, store, say, saveBar, open } = useQuay();
  const navigate = useNavigate();
  const isNew = id === "new";
  const original = isNew ? undefined : h.products.find((p) => p.id === id);
  const [draft, setDraft] = useState<ProductT | null>(null);
  const [tagText, setTagText] = useState("");
  const [archiveAsk, setArchiveAsk] = useState(false);
  const base = draft ?? original ?? (isNew ? blank() : undefined);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(original ?? blank());

  const save = () => {
    if (!draft) return;
    if (!draft.title.trim()) return say("Give the product a title first.");
    if (isNew) {
      const pid = `prd_${Date.now().toString(36)}`;
      store.commit("Add product", (d) => void d.products.push({ ...draft, id: pid, handle: draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), category: CATEGORY[draft.type], media: draft.media.length ? draft.media : [mediaRef(draft.type, draft.title)] }));
      say(`${draft.title} added as ${STATUS_LABEL[draft.status].toLowerCase()}.`);
      setDraft(null);
      navigate(`/products/${pid}`);
      return;
    }
    const undo = store.commit("Save product", (d) => {
      const i = d.products.findIndex((p) => p.id === draft.id);
      if (i >= 0) d.products[i] = { ...draft, category: CATEGORY[draft.type] };
    });
    setDraft(null);
    say(`${draft.title} saved.`, undo);
  };
  useEffect(() => {
    saveBar(dirty ? { label: "Unsaved changes", onSave: save, onDiscard: () => setDraft(null) } : null);
    return () => saveBar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, draft]);

  if (!base) return <Empty icon="products" title="That product isn't here" body="It may have been removed when the demo was reset." action={<Button to="/products">All products</Button>} />;
  const p = base;
  const edit = (fn: (d: ProductT) => void) =>
    setDraft((cur) => {
      const next = structuredClone(cur ?? p);
      fn(next);
      return next;
    });
  const editVariant = (vid: string, fn: (v: Variant) => void) => edit((d) => fn(d.variants.find((v) => v.id === vid)!));
  const single = p.variants.length === 1 && !p.option;
  const v0 = p.variants[0];
  const margin = (v: Variant) => (v.price > 0 ? (v.price - v.cost) / v.price : 0);
  const committed = (vid: string) => h.orders.filter((o) => o.status === "open").reduce((s, o) => s + o.items.filter((it) => it.variantId === vid).reduce((t, it) => t + it.qty - it.fulfilled, 0), 0);
  const addTag = () => {
    const t = tagText.trim().toLowerCase();
    if (t && !p.tags.includes(t)) edit((d) => void d.tags.push(t));
    setTagText("");
  };
  const archive = () => {
    const undo = store.commit("Archive product", (d) => void (d.products.find((x) => x.id === p.id)!.status = "archived"));
    setArchiveAsk(false);
    say(`${p.title} archived. It's hidden from the store.`, undo);
  };
  const duplicate = () => {
    const pid = `prd_${Date.now().toString(36)}`;
    const undo = store.commit("Duplicate", (d) => void d.products.push({ ...structuredClone(p), id: pid, title: `Copy of ${p.title}`, handle: `copy-of-${p.handle}`, status: "draft", variants: p.variants.map((v, i) => ({ ...v, id: `${pid}_${i}`, sku: `${v.sku}-2` })), createdAt: new Date().toISOString() }));
    say(`Duplicated as a draft.`, undo);
    navigate(`/products/${pid}`);
  };
  return (
    <Page
      back={{ to: "/products", label: "Products" }}
      title={isNew ? "Add product" : p.title}
      titleMeta={!isNew ? <StatusBadge status={p.status} /> : undefined}
      subtitle={!isNew ? `${TYPE_LABEL[p.type]} · ${plural(p.variants.length, "variant")} · added ${shortDate(p.createdAt)}` : undefined}
      secondary={!isNew ? <><Button onClick={duplicate}>Duplicate</Button>{p.status !== "archived" && <Button variant="tertiary" onClick={() => setArchiveAsk(true)}>Archive</Button>}</> : undefined}
      actions={
        !isNew ? (
          <Button icon="spark" onClick={() => open("inventory.restock", { variant: [...p.variants].sort((a, b) => a.inventory - b.inventory)[0].id })}>
            Restock
          </Button>
        ) : undefined
      }
    >
      <div className="q-grid q-grid-main">
        <div className="q-stack q-stack-loose">
          <Card>
            <div className="q-form">
              <Field label="Title" htmlFor="title">
                <input id="title" className="q-input" value={p.title} onChange={(e) => edit((d) => void (d.title = e.target.value))} placeholder="Short sleeve t-shirt" />
              </Field>
              <Field label="Description" htmlFor="description">
                <textarea id="description" className="q-textarea" value={p.description} onChange={(e) => edit((d) => void (d.description = e.target.value))} rows={5} />
              </Field>
            </div>
          </Card>
          <Card title="Media">
            {p.media.length ? (
              <div className="q-media">
                {p.media.map((m, i) => (
                  <img key={m} src={resolveMedia(m)} alt={`${p.title}, picture ${i + 1}`} />
                ))}
                <button type="button" className="q-media-add" onClick={() => edit((d) => void d.media.push(mediaRef(d.type, d.title || "product", d.media.length)))} aria-label="Add a picture">
                  <Icon name="plus" size={18} />
                </button>
              </div>
            ) : (
              <Empty icon="image" title="No media yet" body="Pictures show on the store, in orders and in the index." action={<Button size="slim" onClick={() => edit((d) => void d.media.push(mediaRef(d.type, d.title || "product")))}>Add picture</Button>} />
            )}
          </Card>
          {single ? (
            <>
              <Card title="Pricing">
                <div className="q-form-row">
                  <Field label="Price" htmlFor="price">
                    <span className="q-input-prefix">
                      $<input id="price" className="q-input" type="number" step="0.5" min="0" value={v0.price} onChange={(e) => editVariant(v0.id, (v) => void (v.price = Number(e.target.value)))} />
                    </span>
                  </Field>
                  <Field label="Compare-at price" htmlFor="compare">
                    <span className="q-input-prefix">
                      $<input id="compare" className="q-input" type="number" step="0.5" min="0" value={v0.compareAt ?? ""} onChange={(e) => editVariant(v0.id, (v) => void (v.compareAt = e.target.value ? Number(e.target.value) : undefined))} />
                    </span>
                  </Field>
                  <Field label="Cost per item" htmlFor="cost" hint={`Profit ${money(v0.price - v0.cost)} · Margin ${percent(margin(v0))}`}>
                    <span className="q-input-prefix">
                      $<input id="cost" className="q-input" type="number" step="0.1" min="0" value={v0.cost} onChange={(e) => editVariant(v0.id, (v) => void (v.cost = Number(e.target.value)))} />
                    </span>
                  </Field>
                </div>
              </Card>
              <Card title="Inventory">
                <div className="q-form">
                  <div className="q-form-row">
                    <Field label="SKU (Stock Keeping Unit)" htmlFor="sku">
                      <input id="sku" className="q-input q-mono" value={v0.sku} onChange={(e) => editVariant(v0.id, (v) => void (v.sku = e.target.value))} />
                    </Field>
                    <Field label="Available" htmlFor="available" hint={committed(v0.id) ? `${committed(v0.id)} committed to open orders` : undefined}>
                      <input id="available" className="q-input" type="number" min="0" value={v0.inventory} disabled={!v0.trackQuantity} onChange={(e) => editVariant(v0.id, (v) => void (v.inventory = Math.max(0, Math.floor(Number(e.target.value)))))} />
                    </Field>
                  </div>
                  <Checkbox checked={v0.trackQuantity} onChange={(on) => editVariant(v0.id, (v) => void (v.trackQuantity = on))} label="Track quantity" description="Stops selling when it runs out." />
                  {v0.incoming && (
                    <p className="q-small q-muted">
                      {v0.incoming.qty} incoming, expected {shortDate(`${v0.incoming.expectedAt}T12:00:00`)}.
                    </p>
                  )}
                </div>
              </Card>
              <Card title="Shipping">
                <div className="q-form-row">
                  <Field label="Weight" htmlFor="weight">
                    <span className="q-input-prefix">
                      <input id="weight" className="q-input" type="number" min="0" step="0.5" value={v0.weight} onChange={(e) => editVariant(v0.id, (v) => void (v.weight = Number(e.target.value)))} style={{ paddingLeft: 12 }} />
                      <span style={{ padding: "0 10px" }}>oz</span>
                    </span>
                  </Field>
                </div>
              </Card>
            </>
          ) : (
            <Card title="Variants" padded={false}>
              <div className="q-section" style={{ borderTop: 0, paddingTop: 4 }}>
                <p className="q-small q-muted">
                  Option: <b>{p.option}</b> · {plural(p.variants.length, "variant")}
                </p>
              </div>
              <div className="q-table-wrap">
                <table className="q-table">
                  <caption className="q-sr-only">Variants of {p.title}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Variant</th>
                      <th scope="col">Price</th>
                      <th scope="col">Compare-at</th>
                      <th scope="col">Cost</th>
                      <th scope="col">SKU</th>
                      <th scope="col">Available</th>
                      <th scope="col" className="q-secondary">Days of stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.variants.map((v) => {
                      const cv = original ? cover(h, original, v) : undefined;
                      return (
                        <tr key={v.id}>
                          <td className="q-first">
                            <span className="q-strong">{v.title}</span>
                            <span className="q-cell-sub">Weight {v.weight} oz{v.incoming ? ` · ${v.incoming.qty} incoming ${shortDate(`${v.incoming.expectedAt}T12:00:00`)}` : ""}</span>
                          </td>
                          <td data-label="Price">
                            <input className="q-input" style={{ width: 88 }} type="number" step="0.5" min="0" value={v.price} onChange={(e) => editVariant(v.id, (x) => void (x.price = Number(e.target.value)))} aria-label={`${v.title} price`} />
                          </td>
                          <td data-label="Compare-at">
                            <input className="q-input" style={{ width: 88 }} type="number" step="0.5" min="0" value={v.compareAt ?? ""} onChange={(e) => editVariant(v.id, (x) => void (x.compareAt = e.target.value ? Number(e.target.value) : undefined))} aria-label={`${v.title} compare-at price`} />
                          </td>
                          <td data-label="Cost">
                            <input className="q-input" style={{ width: 80 }} type="number" step="0.1" min="0" value={v.cost} onChange={(e) => editVariant(v.id, (x) => void (x.cost = Number(e.target.value)))} aria-label={`${v.title} cost`} />
                          </td>
                          <td data-label="SKU">
                            <input className="q-input q-mono" style={{ width: 140 }} value={v.sku} onChange={(e) => editVariant(v.id, (x) => void (x.sku = e.target.value))} aria-label={`${v.title} SKU`} />
                          </td>
                          <td data-label="Available">
                            <input className="q-input" style={{ width: 72 }} type="number" min="0" value={v.inventory} onChange={(e) => editVariant(v.id, (x) => void (x.inventory = Math.max(0, Math.floor(Number(e.target.value)))))} aria-label={`${v.title} available`} />
                          </td>
                          <td data-label="Days of stock" className="q-secondary">
                            {cv ? cv.days === null ? <span className="q-muted">No sales</span> : <span className={cv.days <= 7 ? "q-tone-danger" : cv.days <= 14 ? "q-tone-warning" : undefined}>{plural(cv.days, "day")}</span> : "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <div className="q-stack q-stack-loose">
          <Card title="Status">
            <Select label="Status" value={p.status} onChange={(v) => edit((d) => void (d.status = v as ProductStatus))} options={(["active", "draft", "archived"] as ProductStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
            <p className="q-small q-muted" style={{ marginTop: 8 }}>
              {p.status === "active" ? "Available on the online store." : p.status === "draft" ? "Hidden until you make it active." : "Hidden and kept for records."}
            </p>
          </Card>
          <Card title="Product organization">
            <div className="q-form">
              <Field label="Category" htmlFor="category">
                <input id="category" className="q-input" value={CATEGORY[p.type]} readOnly aria-describedby="category-hint" />
              </Field>
              <Field label="Type" htmlFor="type">
                <Select id="type" value={p.type} onChange={(v) => edit((d) => void (d.type = v as ProductType))} options={TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />
              </Field>
              <Field label="Vendor" htmlFor="vendor">
                <input id="vendor" className="q-input" value={p.vendor} onChange={(e) => edit((d) => void (d.vendor = e.target.value))} />
              </Field>
              <Field label="Collections" htmlFor="collections">
                <Select id="collections" value="" onChange={(v) => v && edit((d) => void (!d.collections.includes(v) && d.collections.push(v)))} options={[{ value: "", label: "Add to a collection" }, ...h.collections.filter((c) => !p.collections.includes(c.id)).map((c) => ({ value: c.id, label: c.title }))]} />
                {p.collections.length > 0 && (
                  <div className="q-row" style={{ marginTop: 6 }}>
                    {p.collections.map((cid) => (
                      <Tag key={cid} onRemove={() => edit((d) => void (d.collections = d.collections.filter((x) => x !== cid)))}>
                        {h.collections.find((c) => c.id === cid)?.title ?? cid}
                      </Tag>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Tags" htmlFor="tags">
                <input
                  id="tags"
                  className="q-input"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") (e.preventDefault(), addTag());
                  }}
                  onBlur={addTag}
                  placeholder="Press Enter to add"
                />
                {p.tags.length > 0 && (
                  <div className="q-row" style={{ marginTop: 6 }}>
                    {p.tags.map((t) => (
                      <Tag key={t} onRemove={() => edit((d) => void (d.tags = d.tags.filter((x) => x !== t)))}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          </Card>
          {!isNew && original && (
            <Card title="Sales, last 30 days">
              <dl className="q-kv">
                {original.variants.map((v) => {
                  const cv = cover(h, original, v);
                  return (
                    <span key={v.id} style={{ display: "contents" }}>
                      <dt>{v.title}</dt>
                      <dd>
                        {cv.sold30} sold · {v.inventory} left{cv.days !== null ? ` · ${plural(cv.days, "day")}` : ""}
                      </dd>
                    </span>
                  );
                })}
              </dl>
            </Card>
          )}
        </div>
      </div>
      {isNew && (
        <div className="q-row" style={{ justifyContent: "flex-end" }}>
          <Button variant="tertiary" to="/products">
            Discard
          </Button>
          <Button variant="primary" onClick={save} disabled={!p.title.trim()}>
            Save product
          </Button>
        </div>
      )}
      {archiveAsk && (
        <Modal title={`Archive ${p.title}?`} onClose={() => setArchiveAsk(false)} secondary={<Button onClick={() => setArchiveAsk(false)}>Cancel</Button>} primary={<Button variant="primary" onClick={archive}>Archive product</Button>}>
          <p>Archiving hides the product from the online store and every sales channel. Orders that include it keep their line items. You can unarchive it from the Archived view.</p>
        </Modal>
      )}
    </Page>
  );
}

/* ---- Collections ---- */

export function Collections() {
  const { h } = useQuay();
  const count = (id: string) => h.products.filter((p) => p.collections.includes(id) && p.status === "active").length;
  return (
    <Page title="Collections" subtitle="Groups of products the store shows together." back={{ to: "/products", label: "Products" }}>
      <Card padded={false}>
        <IndexTable
          rows={h.collections}
          rowKey={(c) => c.id}
          href={(c) => `/products/collections/${c.id}`}
          caption="Collections"
          columns={[
            { key: "title", label: "Title", sort: (c) => c.title, render: (c) => (
                <span>
                  <span className="q-strong">{c.title}</span>
                  <span className="q-cell-sub">{c.description}</span>
                </span>
              ) },
            { key: "products", label: "Products", align: "end", sort: (c) => count(c.id), render: (c) => <span className="q-tabular">{count(c.id)}</span> },
            { key: "kind", label: "Product conditions", render: (c) => (c.kind === "automated" ? c.rule : <span className="q-muted">Manual</span>), secondary: true },
          ]}
          empty={<Empty icon="products" title="No collections" />}
        />
      </Card>
    </Page>
  );
}

export function Collection() {
  const { id } = useParams();
  const { h, store, say } = useQuay();
  const c = h.collections.find((x) => x.id === id);
  if (!c) return <Empty icon="products" title="That collection isn't here" action={<Button to="/products/collections">All collections</Button>} />;
  const members = h.products.filter((p) => p.collections.includes(c.id));
  const remove = (pid: string) => {
    const undo = store.commit("Remove from collection", (d) => {
      const p = d.products.find((x) => x.id === pid)!;
      p.collections = p.collections.filter((x) => x !== c.id);
    });
    say(`Removed from ${c.title}.`, undo);
  };
  const add = (pid: string) => {
    if (!pid) return;
    const undo = store.commit("Add to collection", (d) => void d.products.find((x) => x.id === pid)!.collections.push(c.id));
    say(`Added to ${c.title}.`, undo);
  };
  return (
    <Page back={{ to: "/products/collections", label: "Collections" }} title={c.title} titleMeta={<Badge tone={c.kind === "automated" ? "info" : "neutral"}>{c.kind === "automated" ? "Automated" : "Manual"}</Badge>} subtitle={c.description}>
      <div className="q-grid q-grid-main">
        <Card title={`Products (${members.length})`} padded={false} actions={c.kind === "manual" ? <Select slim label="Add product" value="" onChange={add} options={[{ value: "", label: "Add product" }, ...h.products.filter((p) => !p.collections.includes(c.id)).map((p) => ({ value: p.id, label: p.title }))]} /> : undefined}>
          <IndexTable
            rows={members}
            rowKey={(p) => p.id}
            href={(p) => `/products/${p.id}`}
            caption={`Products in ${c.title}`}
            columns={[
              { key: "title", label: "Product", sort: (p) => p.title, render: (p) => (
                  <span className="q-entity">
                    <Thumb media={p.media[0]} size={32} />
                    <span className="q-entity-text">
                      <span className="q-entity-name">{p.title}</span>
                    </span>
                  </span>
                ) },
              { key: "status", label: "Status", render: (p) => <StatusBadge status={p.status} /> },
              { key: "price", label: "Price", align: "end", render: (p) => <span className="q-tabular">{p.variants.length > 1 ? `from ${money(Math.min(...p.variants.map((v) => v.price)))}` : money(p.variants[0].price)}</span> },
              ...(c.kind === "manual" ? [{ key: "remove", label: "", render: (p: ProductT) => <Button size="slim" variant="tertiary" onClick={() => remove(p.id)}>Remove</Button> }] : []),
            ]}
            empty={<Empty icon="products" title="Nothing in this collection" body={c.kind === "automated" ? `Products join when ${c.rule?.toLowerCase()}.` : "Add products from the menu above."} />}
          />
        </Card>
        <Card title="Conditions">
          {c.kind === "automated" ? (
            <p>
              Products are added automatically when: <b>{c.rule}</b>.
            </p>
          ) : (
            <p className="q-muted">Products are added by hand.</p>
          )}
        </Card>
      </div>
    </Page>
  );
}

/* ---- Inventory: every tracked variant, editable on the spot. ---- */

export function Inventory() {
  const { h, store, say, open } = useQuay();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return covers(h)
      .filter((c) => !needle || c.product.title.toLowerCase().includes(needle) || c.variant.sku.toLowerCase().includes(needle))
      .filter((c) => !lowOnly || c.variant.inventory === 0 || (c.days !== null && c.days <= 14))
      .sort((a, b) => a.product.title.localeCompare(b.product.title) || a.variant.title.localeCompare(b.variant.title));
  }, [h, q, lowOnly]);
  const committed = (vid: string) => h.orders.filter((o) => o.status === "open").reduce((s, o) => s + o.items.filter((it) => it.variantId === vid).reduce((t, it) => t + it.qty - it.fulfilled, 0), 0);
  const setQty = (vid: string, n: number, label: string) => {
    const undo = store.commit("Adjust inventory", (d) => {
      for (const p of d.products) for (const v of p.variants) if (v.id === vid) v.inventory = Math.max(0, Math.floor(n));
    });
    say(`${label}: ${Math.max(0, Math.floor(n))} available.`, undo);
  };
  return (
    <Page title="Inventory" subtitle={`${plural(rows.length, "variant")} tracked at ${h.shop.address.city}, ${h.shop.address.state}.`} back={{ to: "/products", label: "Products" }} fullWidth actions={<Button icon="spark" onClick={() => open("inventory.restock")}>Record a delivery</Button>}>
      <Card padded={false}>
        <div className="q-toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Search product or SKU" label="Search inventory" />
          <Checkbox checked={lowOnly} onChange={setLowOnly} label="Low stock only" />
          <span className="q-spacer" />
          <span className="q-small q-muted">{plural(rows.length, "variant")}</span>
        </div>
        <IndexTable
          rows={rows}
          rowKey={(c) => c.variant.id}
          caption="Inventory"
          columns={[
            { key: "product", label: "Product", sort: (c) => c.product.title, render: (c) => (
                <span className="q-entity">
                  <Thumb media={c.product.media[0]} size={32} />
                  <span className="q-entity-text">
                    <Link to={`/products/${c.product.id}`} className="q-entity-name q-link">
                      {c.product.title}
                    </Link>
                    <span className="q-entity-sub">{c.product.option ? `${c.variant.title} · ` : ""}{c.variant.sku}</span>
                  </span>
                </span>
              ) },
            { key: "committed", label: "Committed", align: "end", render: (c) => <span className="q-tabular">{committed(c.variant.id)}</span>, secondary: true },
            { key: "available", label: "Available", align: "end", sort: (c) => c.variant.inventory, render: (c) => <InventoryInput value={c.variant.inventory} onCommit={(n) => setQty(c.variant.id, n, c.product.option ? `${c.product.title} (${c.variant.title})` : c.product.title)} label={`${c.product.title} ${c.variant.title} available`} /> },
            { key: "incoming", label: "Incoming", align: "end", render: (c) => (c.variant.incoming ? <span className="q-tabular">{c.variant.incoming.qty} <span className="q-muted">{shortDate(`${c.variant.incoming.expectedAt}T12:00:00`)}</span></span> : <span className="q-muted">–</span>), secondary: true },
            { key: "days", label: "Days of stock", align: "end", sort: (c) => c.days ?? 9999, render: (c) => (c.days === null ? <span className="q-muted">No sales</span> : <span className={c.days <= 7 ? "q-tone-danger" : c.days <= 14 ? "q-tone-warning" : undefined}>{c.days}</span>) },
          ]}
          empty={<Empty icon="box" title="No variants match" body={lowOnly ? "Nothing is low on stock." : "Try another word."} />}
        />
      </Card>
    </Page>
  );
}

function InventoryInput({ value, onCommit, label }: { value: number; onCommit: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setText(String(value));
  };
  return <input className="q-input q-num" style={{ width: 80 }} type="number" min="0" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label={label} />;
}
