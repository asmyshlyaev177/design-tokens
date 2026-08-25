/** The contrast contract. Rationale in CLAUDE.md. */
import {
  AA_LARGE,
  AA_NORMAL,
  contrast,
  oklchToRgb,
  parseOklch,
  type Rgb,
} from "./color.ts";
import { parseTokens, resolve, type Scope, type Theme } from "./parse.ts";
import { lc, LC_BODY, LC_BODY_MIN, LC_LARGE, LC_UI } from "./apca.ts";
import type { Hues } from "./hues.ts";

/** --surface-2 is the lightest ground, so it decides the contract. */
const GROUNDS = ["--bg", "--surface", "--surface-2"] as const;

export const THEMES: Theme[] = ["light", "dark"];

interface Pair {
  token: string;
  on: readonly string[];
  /** WCAG 2 ratio. */
  floor: number;
  /** APCA Lc, calibrated against shipping design systems — see CLAUDE.md. */
  lcFloor: number;
  why: string;
}

const PAIRS: Pair[] = [
  {
    token: "--ink",
    on: GROUNDS,
    floor: AA_NORMAL,
    lcFloor: LC_BODY,
    why: "body text",
  },
  {
    token: "--muted",
    on: GROUNDS,
    floor: AA_NORMAL,
    lcFloor: 70,
    why: "secondary text must not need a size exemption",
  },
  {
    token: "--faint",
    on: GROUNDS,
    floor: AA_LARGE,
    lcFloor: LC_UI,
    why: "large text and icons only",
  },
  {
    token: "--link",
    on: ["--bg"],
    floor: AA_NORMAL,
    lcFloor: LC_LARGE,
    why: "--primary is a fill and is not readable as link text at every hue",
  },
  {
    token: "--primary-on-soft",
    on: ["--primary-soft", ...GROUNDS],
    floor: AA_NORMAL,
    lcFloor: LC_LARGE,
    why: "brand text, on its own tint and on any surface",
  },
  {
    token: "--accent-on-soft",
    // The only accent-coloured *text* token; --accent is a fill.
    on: ["--accent-soft", ...GROUNDS],
    floor: AA_NORMAL,
    lcFloor: LC_LARGE,
    why: "accent text, on its own tint and on any surface",
  },
  {
    token: "--on-primary",
    on: ["--primary"],
    floor: AA_NORMAL,
    lcFloor: LC_BODY_MIN,
    why: "label on the brand fill",
  },
];

export interface ContractResult {
  token: string;
  on: string;
  theme: Theme;
  ratio: number;
  floor: number;
  lc: number;
  lcFloor: number;
  why: string;
  /** True only when the pair satisfies both models. */
  passes: boolean;
}

function rgbOf(scope: Scope, name: string): Rgb | null {
  const value = scope.get(name);
  const oklch = value ? parseOklch(resolve(value, scope)) : null;
  return oklch ? oklchToRgb(oklch) : null;
}

/** @returns every pair, passing and failing alike. */
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
    for (const { token, on, floor, lcFloor, why } of PAIRS) {
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
            lc: 0,
            lcFloor,
            why: `${token} or ${ground} did not resolve to a colour`,
            passes: false,
          });
          continue;
        }
        const ratio = contrast(fg, bg);
        const lcValue = lc(fg, bg);
        results.push({
          token,
          on: ground,
          theme,
          ratio,
          floor,
          lc: lcValue,
          lcFloor,
          why,
          passes: ratio >= floor && lcValue >= lcFloor,
        });
      }
    }
  }
  return results;
}

export const failures = (results: ContractResult[]): ContractResult[] =>
  results.filter((r) => !r.passes);

export const describe = (r: ContractResult): string => {
  const parts: string[] = [];
  if (r.ratio < r.floor) {
    parts.push(`WCAG ${r.ratio.toFixed(2)}:1, needs ${r.floor}:1`);
  }
  if (r.lc < r.lcFloor) {
    parts.push(`APCA Lc ${r.lc.toFixed(0)}, needs ${r.lcFloor}`);
  }
  const failed = parts.length ? parts.join(" and ") : "passes both models";
  return `${r.theme}: ${r.token} on ${r.on} — ${failed} — ${r.why}`;
};
