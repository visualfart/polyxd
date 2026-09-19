import { useEffect, useMemo, useState } from "react";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";

/**
 * Blind ranking of the gold set (bench/gold). Each group shows three versions of one interface in a
 * shuffled order with neutral names, so the rater can't tell which is the original. Rankings are saved
 * to bench/gold/ranking.json through the dev server (see vite.config.ts).
 */
const goldFiles = import.meta.glob<{ default: UIDocument }>("../../../bench/gold/*.json", { eager: true });
const docs = Object.fromEntries(
  Object.entries(goldFiles)
    .filter(([p]) => !p.endsWith("ranking.json"))
    .map(([p, m]) => [p.split("/").pop()!.replace(".json", ""), m.default]),
);

interface Group {
  id: string;
  source: string;
  domain: string;
  variants: string[];
  humanRank: string[] | null;
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
  const [index, setIndex] = useState(0);
  const [theme, setTheme] = useState("material3");
  const [width, setWidth] = useState<390 | 1100>(390);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/gold-ranking")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((file) => {
        setGroups(file.groups);
        setRater(file.rater ?? "");
        setRanks(Object.fromEntries(file.groups.filter((g: Group) => g.humanRank).map((g: Group) => [g.id, g.humanRank!])));
        const firstOpen = file.groups.findIndex((g: Group) => !g.humanRank);
        setIndex(firstOpen === -1 ? 0 : firstOpen);
      })
      .catch(() => setError("The ranking page needs the local gallery dev server (npm run dev -w @polyxd/gallery)."));
  }, []);

  const group = groups[index];
  const options = useMemo(() => (group ? shuffled(group.variants, group.id) : []), [group]);
  const order = (group && ranks[group.id]) ?? [];
  const done = Object.keys(ranks).filter((k) => ranks[k].length === groups.find((g) => g.id === k)?.variants.length).length;

  const save = async (next: Record<string, string[]>) => {
    setStatus("Saving…");
    try {
      const res = await fetch("/api/gold-ranking", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rater, ranks: next }) });
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
              <div className="r-frame" style={{ width }}>
                <PolyxdSurface key={`${v}-${theme}`} document={docs[v]} theme={theme} mode="light" resolveMedia={placeholder} />
              </div>
            </section>
          );
        })}
      </div>

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
          All {groups.length} groups ranked and saved to <code>bench/gold/ranking.json</code>. Tell Claude, or run <code>npm run gold -w @polyxd/verifier</code> to see how the verifier agrees.
        </p>
      )}
    </div>
  );
}
