/**
 * APCA 0.1.9. Not a standard, and not WCAG's piecewise linearisation —
 * see CLAUDE.md. Pinned against `apca-w3` in apca.test.ts.
 */
import type { Rgb } from "./color.ts";

const BLACK_CLAMP = 0.022;
const BLACK_EXP = 1.414;

function screenLuminance({ r, g, b }: Rgb): number {
  const y = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4;
  return y < BLACK_CLAMP ? y + (BLACK_CLAMP - y) ** BLACK_EXP : y;
}

/** Signed, ~-108..106; positive is dark-on-light. Thresholds want {@link lc}. */
export function apcaContrast(text: Rgb, background: Rgb): number {
  const yText = screenLuminance(text);
  const yBg = screenLuminance(background);

  if (yBg > yText) {
    const s = (yBg ** 0.56 - yText ** 0.57) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (yBg ** 0.65 - yText ** 0.62) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

/** Absolute Lc, the unit the thresholds are stated in. */
export const lc = (text: Rgb, background: Rgb): number =>
  Math.abs(apcaContrast(text, background));

/** APCA's own tiers. The contract does not use them verbatim — see CLAUDE.md. */
export const LC_BODY = 90;
export const LC_BODY_MIN = 75;
export const LC_LARGE = 60;
export const LC_UI = 45;
