/**
 * Parser for tokens.css.
 *
 * Takes the stylesheet as text rather than reading it, so the same code serves
 * a build-time page that gets it from a bundler as `?raw` and the node tests
 * that read it from disk.
 */

export type Theme = "light" | "dark";

/** Token name -> authored value, one theme's side of every light-dark(). */
export type Scope = Map<string, string>;

export interface ParsedTokens {
  light: Scope;
  dark: Scope;
  /** Token name -> the `/* --- heading --- *\/` it was declared under. */
  groups: Map<string, string>;
}

const UNGROUPED = "Other";

/** Body of the first `{...}` at or after `index`, brace-counted for nesting. */
function blockAt(source: string, index: number): string {
  const start = source.indexOf("{", index);
  if (start === -1) return "";
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return "";
}

function declarationsOf(block: string): Scope {
  const out: Scope = new Map();
  const flat = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, name, value] of flat.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(name!, value!.trim().replace(/\s+/g, " "));
  }
  return out;
}

/** Group headings, in source order, mapped to the tokens declared under them. */
function groupsOf(block: string): Map<string, string> {
  const out = new Map<string, string>();
  let current = UNGROUPED;
  const pattern = /\/\*\s*---+\s*(.+?)\s*-*\s*\*\/|(--[\w-]+)\s*:/g;
  for (const [, heading, name] of block.matchAll(pattern)) {
    if (heading) current = heading.replace(/\s*-+\s*$/, "").trim();
    else if (name) out.set(name, current);
  }
  return out;
}

/**
 * Picks one side of every `light-dark(a, b)` in a value. Both ramps live in
 * the same declaration, so reading a theme means choosing an argument rather
 * than reading a second block.
 */
export function pickTheme(value: string, theme: Theme): string {
  const index = value.indexOf("light-dark(");
  if (index === -1) return value;
  const open = index + "light-dark(".length;
  let depth = 1;
  let split = -1;
  let i = open;
  for (; depth > 0; i += 1) {
    const c = value[i];
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if (c === "," && depth === 1) split = i;
  }
  const chosen =
    theme === "dark"
      ? value.slice(split + 1, i - 1).trim()
      : value.slice(open, split).trim();
  return pickTheme(value.slice(0, index) + chosen + value.slice(i), theme);
}

/** Substitutes `var(--x)` against `scope` until nothing is left to substitute. */
export function resolve(value: string, scope: Scope): string {
  let out = value;
  for (let pass = 0; pass < 8 && out.includes("var("); pass += 1) {
    const next = out.replace(
      /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g,
      (whole, name: string, fallback?: string) =>
        scope.get(name) ?? fallback ?? whole,
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * @param source contents of tokens.css
 * @param overrides knob values to substitute, standing in for what a consuming
 *   stylesheet sets after the import
 */
export function parseTokens(
  source: string,
  overrides: Record<string, string | number> = {},
): ParsedTokens {
  const block = blockAt(source, source.indexOf(":root"));
  const root = declarationsOf(block);
  const light: Scope = new Map();
  const dark: Scope = new Map();
  for (const [name, value] of root) {
    light.set(name, pickTheme(value, "light"));
    dark.set(name, pickTheme(value, "dark"));
  }
  for (const [name, value] of Object.entries(overrides)) {
    light.set(name, String(value));
    dark.set(name, String(value));
  }
  return { light, dark, groups: groupsOf(block) };
}

/**
 * Every `light-dark()` must take exactly two arguments. A shadow is itself a
 * comma-separated list, so wrapping one whole rather than wrapping its colour
 * silently produces a four-argument call that the browser drops.
 *
 * @returns the malformed calls
 */
export function malformedLightDark(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const bad: string[] = [];
  for (const match of code.matchAll(/light-dark\(/g)) {
    let depth = 1;
    let args = 1;
    let i = match.index + match[0].length;
    for (; depth > 0; i += 1) {
      const c = code[i];
      if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
      else if (c === "," && depth === 1) args += 1;
    }
    if (args !== 2) bad.push(code.slice(match.index, i));
  }
  return bad;
}
