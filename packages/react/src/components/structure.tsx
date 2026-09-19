import { createElement, useContext, useId, useState } from "react";
import { Collapsible, Tabs } from "radix-ui";
import { HeadingContext, useBindings, useSurface, type Node } from "../context.tsx";
import { Render, useA11y } from "../surface.tsx";

export function Children({ ids }: { ids?: string[] }) {
  return <>{ids?.map((id) => <Render key={id} id={id} />)}</>;
}

export function Heading({ children, className }: { children: React.ReactNode; className?: string }) {
  const level = Math.min(useContext(HeadingContext), 6);
  return createElement(`h${level}`, { className }, children);
}

export function Section({ node }: { node: Node }) {
  const b = useBindings();
  const level = useContext(HeadingContext);
  const headingId = useId();
  return (
    <section className="pxd-section" aria-labelledby={headingId} {...useA11y(node)}>
      <div className="pxd-section-header">
        {createElement(`h${Math.min(level, 6)}`, { id: headingId, className: "pxd-section-title" }, b.text(node.title))}
        {node.description !== undefined && <p className="pxd-section-description">{b.text(node.description)}</p>}
      </div>
      <HeadingContext.Provider value={level + 1}>
        <div className="pxd-stack">
          <Children ids={node.children} />
        </div>
      </HeadingContext.Provider>
    </section>
  );
}

export function Group({ node }: { node: Node }) {
  const s = useSurface();
  // A group of numbers reads as one strip of tiles, not a stack of blocks.
  const children = (node.children ?? []).map((id: string) => s.byId.get(id));
  const metrics = children.length > 1 && children.every((c: Node | undefined) => c?.component === "Metric");
  return (
    <div className={`pxd-group pxd-stack${metrics ? " pxd-metric-row" : ""}`} {...useA11y(node)}>
      <Children ids={node.children} />
    </div>
  );
}

export function Card({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const title = b.text(node.title);
  const badgeTone = node.badge?.tone ?? "neutral";
  return (
    <article className={`pxd-card${node.action ? " pxd-card-actionable" : ""}`} {...useA11y(node)}>
      {node.media && (
        <div className="pxd-card-media">
          <Render id={node.media} />
        </div>
      )}
      <div className="pxd-card-body">
        <div className="pxd-card-header">
          <Heading className="pxd-card-title">
            {node.action ? (
              // Stretched button: the whole card is one target, named by its title.
              <button type="button" className="pxd-card-link" onClick={() => s.dispatch(node.action, b.scope, node.id)}>
                {title}
              </button>
            ) : (
              title
            )}
          </Heading>
          {node.badge && <span className={`pxd-badge pxd-tone-${badgeTone}`}>{b.text(node.badge.text)}</span>}
        </div>
        {node.subtitle !== undefined && <p className="pxd-card-subtitle">{b.text(node.subtitle)}</p>}
        {node.progress && <Progress value={b.value(node.progress.value)} label={(node.progress.label !== undefined && b.text(node.progress.label)) || undefined} name={title} locale={s.locale} />}
        {node.children && (
          <div className="pxd-stack pxd-stack-tight pxd-card-children">
            <Children ids={node.children} />
          </div>
        )}
      </div>
    </article>
  );
}

/** Progress through an entity: a bar with its label, or the percentage. */
function Progress({ value, label, name, locale }: { value: unknown; label?: string; name: string; locale: string }) {
  const v = Math.max(0, Math.min(1, Number(value) || 0));
  const pct = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(v);
  return (
    <div className="pxd-progress">
      <div className="pxd-progress-track" role="progressbar" aria-label={`Progress: ${name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-valuetext={label ?? pct}>
        <div className="pxd-progress-fill" style={{ width: `${v * 100}%` }} />
      </div>
      <span className="pxd-progress-label">{label ?? pct}</span>
    </div>
  );
}

export function Disclosure({ node }: { node: Node }) {
  const b = useBindings();
  const [open, setOpen] = useState<boolean>(node.open ?? false);
  return (
    <Collapsible.Root className="pxd-disclosure" open={open} onOpenChange={setOpen} {...useA11y(node)}>
      <Collapsible.Trigger className="pxd-disclosure-trigger">
        <span className="pxd-disclosure-icon" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        {b.text(node.summary)}
      </Collapsible.Trigger>
      <Collapsible.Content className="pxd-disclosure-content">
        <div className="pxd-stack">
          <Children ids={node.children} />
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function Views({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const bound = node.selected ? b.value<string>(node.selected) : undefined;
  const [local, setLocal] = useState<string>(bound ?? node.views[0].key);
  const selected = bound ?? local;
  const change = (key: string) => (node.selected ? b.write(node.selected, key) : setLocal(key));
  return (
    <Tabs.Root className={`pxd-views pxd-views-${node.variant ?? "tabs"}`} value={selected} onValueChange={change} {...useA11y(node)}>
      <Tabs.List className="pxd-views-list">
        {node.views.map((v: any) => {
          const count = v.count !== undefined ? b.value<number>(v.count) : undefined;
          return (
            <Tabs.Trigger key={v.key} value={v.key} className="pxd-views-tab">
              {b.text(v.label)}
              {count !== undefined && <span className="pxd-views-count">{new Intl.NumberFormat(s.locale).format(count)}</span>}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
      {node.views.map((v: any) => (
        <Tabs.Content key={v.key} value={v.key} className="pxd-views-panel">
          <Render id={v.content} />
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
