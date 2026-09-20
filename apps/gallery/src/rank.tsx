import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";

/**
 * Blind ranking. Each group shows versions of one interface in a shuffled order with neutral names,
 * so the rater can't tell which is which. Two sets:
 *   ?rank              the hand-made gold set (bench/gold): does the verifier agree with a designer?
 *   ?rank&set=model    the model's own options (bench/rank-set): are its first options any good?
 * Rankings are saved through the dev server (see vite.config.ts).
 */
const goldFiles = import.meta.glob<{ default: UIDocument }>("../../../bench/gold/*.json", { eager: true });
const modelFiles = import.meta.glob<{ default: UIDocument }>("../../../bench/rank-set/*.json", { eager: true });
export const rankSet = new URLSearchParams(location.search).get("set") === "model" ? "model" : "gold";
const docs = Object.fromEntries(
  Object.entries(rankSet === "model" ? modelFiles : goldFiles)
    .filter(([p]) => !p.endsWith("ranking.json"))
    .map(([p, m]) => [p.split("/").pop()!.replace(".json", ""), m.default]),
);

interface Annotation {
  /** Component id in the UI document, and its type */
  id: string;
  component: string;
  /** The exact part clicked inside the component, e.g. 'button "Next"' */
  part?: string;
  note: string;
}

const PART = "button, a, input, textarea, select, label, h1, h2, h3, h4, legend, dt, dd, li, p, [role=radio], [role=checkbox], [role=switch], [role=tab]";

/** A short description of the element clicked: its role-ish tag and visible text. */
function describePart(el: HTMLElement, component: HTMLElement): { part?: string; key: string } {
  const hit = el.closest<HTMLElement>(PART);
  if (!hit || hit === component || !component.contains(hit)) return { key: "" };
  const role = hit.getAttribute("role") ?? ({ BUTTON: "button", A: "link", INPUT: "field", TEXTAREA: "field", SELECT: "field", LABEL: "label", LEGEND: "label", DT: "label", DD: "value", LI: "item", P: "text" } as Record<string, string>)[hit.tagName] ?? "heading";
  const text = (hit.getAttribute("aria-label") ?? hit.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  const part = text ? `${role} "${text}"` : role;
  return { part, key: part };
}

/** Finds the element an annotation points at: the part inside the component if it can, else the component. */
function findTarget(root: HTMLElement, a: Annotation): HTMLElement | null {
  const component = root.querySelector<HTMLElement>(`[data-pxd-id="${CSS.escape(a.id)}"]`);
  if (!component || !a.part) return component;
  return [...component.querySelectorAll<HTMLElement>(PART)].find((el) => describePart(el, component).part === a.part) ?? component;
}

interface Group {
  id: string;
  source: string;
  domain: string;
  variants: string[];
  humanRank: string[] | null;
  notes?: Record<string, string>;
  comment?: string;
  annotations?: Record<string, Annotation[]>;
}

const THEMES = [
  ["material3", "Material 3"],
  ["carbon", "Carbon"],
  ["antd", "Ant Design"],
] as const;
const PLACES = ["Best", "Second", "Worst"];

/** Deterministic shuffle per group, so the order is stable across reloads but reveals nothing. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function placeholder(ref: string) {
  const hue = [...ref].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="hsl(${hue} 45% 78%)"/></svg>`)}`;
}

export function RankPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [rater, setRater] = useState("");
  const [ranks, setRanks] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, Record<string, string>>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [annotations, setAnnotations] = useState<Record<string, Record<string, Annotation[]>>>({});
  const [annotating, setAnnotating] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [theme, setTheme] = useState("material3");
  const [width, setWidth] = useState<390 | 1100>(390);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/gold-ranking?set=${rankSet}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((file) => {
        setGroups(file.groups);
        setRater(file.rater ?? "");
        setRanks(Object.fromEntries(file.groups.filter((g: Group) => g.humanRank).map((g: Group) => [g.id, g.humanRank!])));
        setNotes(Object.fromEntries(file.groups.filter((g: Group) => g.notes).map((g: Group) => [g.id, g.notes!])));
        setComments(Object.fromEntries(file.groups.filter((g: Group) => g.comment).map((g: Group) => [g.id, g.comment!])));
        setAnnotations(Object.fromEntries(file.groups.filter((g: Group) => g.annotations).map((g: Group) => [g.id, g.annotations!])));
        const firstOpen = file.groups.findIndex((g: Group) => !g.humanRank);
        setIndex(firstOpen === -1 ? 0 : firstOpen);
      })
      .catch(() => setError("The ranking page needs the local gallery dev server (npm run dev -w @polyxd/gallery)."));
  }, []);

  const group = groups[index];
  const options = useMemo(() => (group ? shuffled(group.variants, group.id) : []), [group]);
  const order = (group && ranks[group.id]) ?? [];
  const done = Object.keys(ranks).filter((k) => ranks[k].length === groups.find((g) => g.id === k)?.variants.length).length;

  // Saves read the latest annotations even when called from a handler created before the last update.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const markOf = (a: Annotation) => `${a.id}${a.part ? `|${a.part}` : ""}`;
  const noteId = (option: number, mark: string) => `note-${option}-${mark.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  const listFor = (variant: string) => annotations[group?.id ?? ""]?.[variant] ?? [];
  const setList = (variant: string, list: Annotation[]) => {
    const next = { ...annotations, [group.id]: { ...annotations[group.id], [variant]: list } };
    setAnnotations(next);
    annotationsRef.current = next;
  };
  const annotateClick = (variant: string, e: MouseEvent<HTMLDivElement>) => {
    if (annotating !== variant) return;
    // In annotate mode a click picks the element instead of operating it.
    e.preventDefault();
    e.stopPropagation();
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pxd-id]");
    if (!el) return;
    const { part, key } = describePart(e.target as HTMLElement, el);
    const id = el.dataset.pxdId!;
    const mark = `${id}${key ? `|${key}` : ""}`;
    if (!listFor(variant).some((a) => markOf(a) === mark)) setList(variant, [...listFor(variant), { id, component: el.dataset.pxdComponent ?? "", ...(part ? { part } : {}), note: "" }]);
    const option = options.indexOf(variant) + 1;
    requestAnimationFrame(() => document.getElementById(noteId(option, mark))?.focus());
  };

  const save = async (next: Record<string, string[]> = ranks) => {
    setStatus("Saving…");
    try {
      const res = await fetch(`/api/gold-ranking?set=${rankSet}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rater, ranks: next, notes, comments, annotations: annotationsRef.current }) });
      const body = await res.json();
      setStatus(res.ok ? `Saved · ${body.ranked} of ${groups.length} groups ranked` : `Couldn't save: ${body.error}`);
    } catch {
      setStatus("Couldn't reach the dev server to save.");
    }
  };

  const pick = (variant: string) => {
    if (!group || order.includes(variant)) return;
    let next = [...order, variant];
    // Once two are chosen, the last one is necessarily the worst.
    if (next.length === group.variants.length - 1) next = [...next, ...group.variants.filter((v) => !next.includes(v))];
    const all = { ...ranks, [group.id]: next };
    setRanks(all);
    if (next.length === group.variants.length) save(all);
  };
  const reset = () => {
    if (!group) return;
    const { [group.id]: _removed, ...rest } = ranks;
    setRanks(rest);
  };

  if (error) return <div className="r-page"><p className="r-error">{error}</p></div>;
  if (!group) return <div className="r-page"><p>Loading the gold set…</p></div>;

  return (
    <div className="r-page">
      <div className="r-head">
        <div className="r-title">
          <h1>Rank the gold set</h1>
          <p>
            For each group, pick the version you'd ship first, then the next. Judge each as an interface someone has to use: is it clear what will happen, is the right control used, can you see what you need before you commit, could a screen-reader user or an agent tell the controls apart? Try them: they're live.
          </p>
        </div>
        <label className="r-rater">
          Your name
          <input value={rater} onChange={(e) => setRater(e.target.value)} onBlur={() => done && save(ranks)} placeholder="e.g. Neel" autoComplete="name" />
        </label>
      </div>

      <nav className="r-groups" aria-label="Groups">
        {groups.map((g, i) => (
          <button key={g.id} type="button" aria-current={i === index ? "step" : undefined} className={ranks[g.id]?.length === g.variants.length ? "r-done" : undefined} onClick={() => setIndex(i)}>
            {i + 1}
            <span className="sr-only">{ranks[g.id]?.length === g.variants.length ? " (ranked)" : ""}</span>
          </button>
        ))}
        <span className="r-progress">{done} of {groups.length} ranked</span>
      </nav>

      <div className="r-toolbar">
        <strong>
          Group {index + 1} · {group.domain}
        </strong>
        <div className="g-seg" role="group" aria-label="Design system">
          {THEMES.map(([id, name]) => (
            <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)}>
              {name}
            </button>
          ))}
        </div>
        <div className="g-seg" role="group" aria-label="Width">
          <button type="button" aria-pressed={width === 390} onClick={() => setWidth(390)}>Phone</button>
          <button type="button" aria-pressed={width === 1100} onClick={() => setWidth(1100)}>Desktop</button>
        </div>
        <button type="button" className="g-reset" onClick={reset} disabled={!order.length}>
          Clear this group
        </button>
      </div>

      <div className={`r-options${width === 1100 ? " r-wide" : ""}`}>
        {options.map((v, i) => {
          const place = order.indexOf(v);
          return (
            <section key={`${group.id}-${v}`} className={`r-option${place >= 0 ? " r-picked" : ""}`} aria-label={`Option ${i + 1}`}>
              <div className="r-option-head">
                <h2>Option {i + 1}</h2>
                {place >= 0 ? (
                  <span className={`r-badge r-badge-${place}`}>{PLACES[place]}</span>
                ) : (
                  <button type="button" className="r-choose" onClick={() => pick(v)}>
                    Choose as {PLACES[order.length].toLowerCase()}
                  </button>
                )}
              </div>
              <div className="r-annotate-bar">
                <button type="button" className={`r-annotate${annotating === v ? " r-on" : ""}`} aria-pressed={annotating === v} onClick={() => setAnnotating(annotating === v ? null : v)}>
                  {annotating === v ? "Done annotating" : "Annotate"}
                </button>
                {annotating === v && <span>Click any element to leave a note on it.</span>}
              </div>
              <AnnotatedFrame width={width} active={annotating === v} marks={listFor(v)} onClickCapture={(e) => annotateClick(v, e)}>
                <PolyxdSurface key={`${v}-${theme}`} document={docs[v]} theme={theme} mode="light" resolveMedia={placeholder} />
              </AnnotatedFrame>
              {listFor(v).length > 0 && (
                <ol className="r-marks">
                  {listFor(v).map((a, n) => (
                    <li key={markOf(a)}>
                      <label htmlFor={noteId(i + 1, markOf(a))}>
                        <span className="r-mark-num">{n + 1}</span> {a.component}
                        {a.part && <span className="r-part"> › {a.part}</span>}
                      </label>
                      <textarea
                        id={noteId(i + 1, markOf(a))}
                        rows={2}
                        value={a.note}
                        placeholder="What's wrong or right about this element?"
                        onChange={(e) => setList(v, listFor(v).map((x) => (markOf(x) === markOf(a) ? { ...x, note: e.target.value } : x)))}
                        onBlur={() => save()}
                      />
                      <button type="button" className="r-mark-remove" aria-label={`Remove note ${n + 1}`} onClick={() => (setList(v, listFor(v).filter((x) => markOf(x) !== markOf(a))), save())}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <label className="r-note">
                Notes on option {i + 1} <span>(optional)</span>
                <textarea
                  rows={3}
                  value={notes[group.id]?.[v] ?? ""}
                  placeholder="What works, what doesn't, what you'd change"
                  onChange={(e) => setNotes({ ...notes, [group.id]: { ...notes[group.id], [v]: e.target.value } })}
                  onBlur={() => save()}
                />
              </label>
            </section>
          );
        })}
      </div>

      <label className="r-note r-note-group">
        Notes on this group <span>(optional: why you ranked them this way, anything the options all miss)</span>
        <textarea rows={3} value={comments[group.id] ?? ""} onChange={(e) => setComments({ ...comments, [group.id]: e.target.value })} onBlur={() => save()} />
      </label>

      <div className="r-foot">
        <button type="button" className="g-reset" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous group
        </button>
        <span role="status" aria-live="polite">{status}</span>
        <button type="button" className="r-next" disabled={index === groups.length - 1} onClick={() => setIndex(index + 1)}>
          Next group
        </button>
      </div>
      {done === groups.length && (
        <p className="r-finished" role="status">
          All {groups.length} groups ranked and saved to <code>{rankSet === "model" ? "bench/rank-set" : "bench/gold"}/ranking.json</code>. Tell Claude, or run <code>npm run gold -w @polyxd/verifier</code> to see how the verifier agrees.
        </p>
      )}
    </div>
  );
}

/** The rendered surface, with numbered markers over annotated elements and hover outlines while annotating. */
function AnnotatedFrame({ width, active, marks, onClickCapture, children }: { width: number; active: boolean; marks: Annotation[]; onClickCapture: (e: MouseEvent<HTMLDivElement>) => void; children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ id: string; top: number; left: number; width: number; height: number }[]>([]);
  const [hover, setHover] = useState<DOMRect | null>(null);
  const measure = () => {
    const root = frame.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    setBoxes(
      marks.flatMap((m) => {
        const el = findTarget(root, m);
        if (!el) return [];
        const r = el.getBoundingClientRect();
        return [{ id: `${m.id}|${m.part ?? ""}`, top: r.top - base.top, left: r.left - base.left, width: r.width, height: r.height }];
      }),
    );
  };
  useLayoutEffect(measure, [marks, width]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (frame.current) ro.observe(frame.current);
    return () => ro.disconnect();
  });
  const base = frame.current?.getBoundingClientRect();
  return (
    <div
      ref={frame}
      className={`r-frame${active ? " r-annotating" : ""}`}
      style={{ width }}
      onClickCapture={onClickCapture}
      onMouseMove={(e) => {
        if (!active) return;
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pxd-id]");
        if (!el) return setHover(null);
        const { part } = describePart(e.target as HTMLElement, el);
        const hit = part ? (e.target as HTMLElement).closest<HTMLElement>(PART) : el;
        setHover((hit ?? el).getBoundingClientRect());
      }}
      onMouseLeave={() => setHover(null)}
    >
      {children}
      {active && hover && base && <div className="r-hover" style={{ top: hover.top - base.top, left: hover.left - base.left, width: hover.width, height: hover.height }} />}
      {boxes.map((b, n) => (
        <div key={b.id} className="r-box" style={{ top: b.top, left: b.left, width: b.width, height: b.height }}>
          <span className="r-mark-num">{n + 1}</span>
        </div>
      ))}
    </div>
  );
}
