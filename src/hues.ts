/**
 * Reads a project's hue knobs out of its own stylesheet. Not block-aware on
 * purpose — `:root`, `@theme` and layers all count. Later sources win.
 */

export interface Hues {
  brand: number;
  accent: number;
  neutral: number;
}

const KNOBS: Record<keyof Hues, string> = {
  brand: "--brand-hue",
  accent: "--accent-hue",
  neutral: "--neutral-hue",
};

/** @param sources stylesheet contents, in precedence order */
export function readHues(sources: string[]): Partial<Hues> {
  const found: Partial<Hues> = {};
  for (const source of sources) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [key, property] of Object.entries(KNOBS) as [
      keyof Hues,
      string,
    ][]) {
      const matches = [
        ...code.matchAll(new RegExp(`${property}\\s*:\\s*([\\d.]+)`, "g")),
      ];
      const last = matches.at(-1);
      if (last) found[key] = Number(last[1]);
    }
  }
  return found;
}
