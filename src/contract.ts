/**
 * The contrast contract, checked against a token file at a given set of hues.
 *
 * Every ratio here is measured in OKLCH-authored colour but judged in sRGB
 * relative luminance, because that is where WCAG defines the floor.
 *
 * Two decisions are load-bearing:
 *
 * `--surface-2` is in GROUNDS. It is the lightest ground a token can sit on,
 * so it is the one that decides the contract; measuring against `--bg` alone
 * flatters everything and is how a `/55` alpha tint shipped as body text in
 * the first place.
 *
 * The hues come from the caller. The projects consuming this package each set
 * their own, and a contract that hardcoded the known ones would vouch for a
 * configuration a project might no longer have.
 */
import {
  AA_LARGE,
  AA_NORMAL,
  contrast,
  oklchToRgb,
  parseOklch,
  type Rgb,
} from "./color.ts";
import { parseTokens, resolve, type Scope, type Theme } from "./parse.ts";
import type { Hues } from "./hues.ts";

/** The lightest ground each foreground token has to clear. */
const GROUNDS = ["--bg", "--surface", "--surface-2"] as const;

export const THEMES: Theme[] = ["light", "dark"];

interface Pair {
  token: string;
  /** A list when the token can land on any surface; one entry when the
   *  pairing is specific — text on its own tint, a label on its own fill. */
  on: readonly string[];
  floor: number;
  why: string;
}

const PAIRS: Pair[] = [
  { token: "--ink", on: GROUNDS, floor: AA_NORMAL, why: "body text" },
  {
    token: "--muted",
    on: GROUNDS,
    floor: AA_NORMAL,
    why: "secondary text must not need a size exemption",
  },
  {
    token: "--faint",
    on: GROUNDS,
    floor: AA_LARGE,
    why: "large text and icons only",
  },
  {
    token: "--link",
    on: ["--bg"],
    floor: AA_NORMAL,
    why: "--primary is a fill and is not readable as link text at every hue",
  },
  {
    token: "--primary-on-soft",
    on: ["--primary-soft"],
    floor: AA_NORMAL,
    why: "brand text on its own tint",
  },
  {
    token: "--accent-on-soft",
    on: ["--accent-soft"],
    floor: AA_NORMAL,
    why: "accent text on its own tint",
  },
  {
    token: "--on-primary",
    on: ["--primary"],
    floor: AA_NORMAL,
    why: "label on the brand fill",
  },
];

export interface ContractResult {
  token: string;
  on: string;
  theme: Theme;
  ratio: number;
  floor: number;
  why: string;
  passes: boolean;
}

function rgbOf(scope: Scope, name: string): Rgb | null {
  const value = scope.get(name);
  const oklch = value ? parseOklch(resolve(value, scope)) : null;
  return oklch ? oklchToRgb(oklch) : null;
}

/**
 * @param source contents of tokens.css
 * @param hues the consuming project's knob values; anything omitted falls back
 *   to the token file's own default
 * @returns every pair, passing and failing alike
 */
export function checkContract(
  source: string,
  hues: Partial<Hues> = {},
): ContractResult[] {
  const overrides: Record<string, number> = {};
  if (hues.brand !== undefined) overrides["--brand-hue"] = hues.brand;
  if (hues.accent !== undefined) overrides["--accent-hue"] = hues.accent;
  if (hues.neutral !== undefined) overrides["--neutral-hue"] = hues.neutral;

  const scopes = parseTokens(source, overrides);
  const results: ContractResult[] = [];

  for (const theme of THEMES) {
    for (const { token, on, floor, why } of PAIRS) {
      for (const ground of on) {
        const fg = rgbOf(scopes[theme], token);
        const bg = rgbOf(scopes[theme], ground);
        if (!fg || !bg) {
          results.push({
            token,
            on: ground,
            theme,
            ratio: 0,
            floor,
            why: `${token} or ${ground} did not resolve to a colour`,
            passes: false,
          });
          continue;
        }
        const ratio = contrast(fg, bg);
        results.push({
          token,
          on: ground,
          theme,
          ratio,
          floor,
          why,
          passes: ratio >= floor,
        });
      }
    }
  }
  return results;
}

export const failures = (results: ContractResult[]): ContractResult[] =>
  results.filter((r) => !r.passes);

export const describe = ({
  token,
  on,
  theme,
  ratio,
  floor,
  why,
}: ContractResult): string =>
  `${theme}: ${token} on ${on} is ${ratio.toFixed(2)}:1, needs ${floor}:1 — ${why}`;
