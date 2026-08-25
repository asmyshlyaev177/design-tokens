/**
 * Pins the reimplementation against the official `apca-w3`. Reimplemented so
 * consumers install nothing; that trade only holds if the two agree.
 */
import assert from "node:assert/strict";

import { test } from "vitest";

import { APCAcontrast, sRGBtoY } from "apca-w3";
import { colorParsley } from "colorparsley";

import {
  apcaContrast,
  lc,
  LC_BODY,
  LC_BODY_MIN,
  LC_LARGE,
  LC_UI,
} from "../src/apca.ts";
import { hexToRgb } from "../src/color.ts";

const official = (text: string, bg: string) =>
  Number(APCAcontrast(sRGBtoY(colorParsley(text)), sRGBtoY(colorParsley(bg))));

/** Both polarities, the black clamp, and colours from the ramp. */
const PAIRS: [string, string][] = [
  ["#000000", "#ffffff"],
  ["#ffffff", "#000000"],
  ["#888888", "#ffffff"],
  ["#ffffff", "#888888"],
  ["#171b21", "#f5f6f7"],
  ["#5b5e65", "#f5f6f7"],
  ["#7d8088", "#ebecef"],
  ["#eceef2", "#0a0d14"],
  ["#c6cad2", "#0a0d14"],
  ["#8fcbff", "#161b28"],
  ["#010101", "#020202"],
];

test("apcaContrast matches the official apca-w3 implementation", () => {
  for (const [text, bg] of PAIRS) {
    assert.ok(
      Math.abs(
        apcaContrast(hexToRgb(text), hexToRgb(bg)) - official(text, bg),
      ) < 0.05,
      `${text} on ${bg}: ours ${apcaContrast(hexToRgb(text), hexToRgb(bg)).toFixed(2)}, ` +
        `official ${official(text, bg).toFixed(2)}`,
    );
  }
});

test("apcaContrast carries polarity, lc drops it", () => {
  const black = hexToRgb("#000000");
  const white = hexToRgb("#ffffff");
  assert.ok(apcaContrast(black, white) > 0, "dark on light is positive");
  assert.ok(apcaContrast(white, black) < 0, "light on dark is negative");
  assert.equal(lc(white, black), Math.abs(apcaContrast(white, black)));
});

test("the readability tiers are ordered as APCA defines them", () => {
  assert.ok(LC_BODY > LC_BODY_MIN);
  assert.ok(LC_BODY_MIN > LC_LARGE);
  assert.ok(LC_LARGE > LC_UI);
});

test("WCAG and APCA disagree about polarity, which is why both are checked", () => {
  // The pair that motivated APCA: clears WCAG AA, rates under half of body level.
  const wasShipped = hexToRgb("#8b8f97");
  const darkBg = hexToRgb("#0a0d14");
  assert.ok(
    lc(wasShipped, darkBg) < 45,
    "old dark --muted was under the UI tier",
  );
});
