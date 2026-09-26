/**
 * Reading CSS custom properties: the one part of ds-kit a browser or a Worker can use, so it lives
 * in its own entry (`@polyxd/ds-kit/css`) with no dependency on the spec's validator or on fs.
 */
export type Vars = Record<string, string>;

/**
 * Every custom property from the CSS rules whose selector satisfies `matches`, in file order, so a
 * later rule overrides an earlier one exactly as a browser resolves it. Selectors spanning several
 * lines are handled: a design system's dark block is usually `:root[data-scheme='dark'], :host(…)`.
 *
 * `matches` also receives the enclosing at-rule when there is one, so a caller can skip overrides
 * it can't use — Radix Themes, for example, repeats every colour in display-p3 inside @supports,
 * and contrast is defined on sRGB.
 */
export function cssVars(css: string, matches: (selector: string, atRule?: string) => boolean, prefix = "--"): Vars {
  const out: Vars = {};
  const declarations = new RegExp(`(${prefix}[a-zA-Z0-9-]+)\\s*:\\s*([^;]+);`, "g");
  // A brace scanner rather than a regex: real stylesheets nest rules inside @media and @supports,
  // and a regex that assumes one level silently reads the wrong blocks.
  let depth = 0;
  let start = 0;
  const stack: string[] = [];
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim());
      depth++;
      start = i + 1;
    } else if (ch === "}") {
      const selector = stack.pop() ?? "";
      const body = css.slice(start, i);
      // An at-rule wraps other rules; a normal selector's body holds the declarations we want.
      // The nearest enclosing at-rule, so a caller can skip a wide-gamut or print override.
      const atRule = [...stack].reverse().find((s) => s.startsWith("@"));
      if (!selector.startsWith("@") && matches(selector, atRule)) {
        for (const [, name, value] of body.matchAll(declarations)) out[name] = value.trim();
      }
      depth = Math.max(0, depth - 1);
      start = i + 1;
    }
  }
  return out;
}

/** Resolves `var(--x)` references within one set of variables, so tokens hold values. */
export function resolveVars(vars: Vars, depth = 6): Vars {
  const out = { ...vars };
  for (let pass = 0; pass < depth; pass++) {
    let changed = false;
    for (const [name, value] of Object.entries(out)) {
      const next = value.replace(/var\((--[a-zA-Z0-9-]+)(?:\s*,\s*([^)]+))?\)/g, (whole, ref, fallback) => out[ref] ?? fallback ?? whole);
      if (next !== value) {
        out[name] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

