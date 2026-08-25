import assert from "node:assert/strict";

import { test } from "vitest";

import {
  contrast,
  flatten,
  formatOklch,
  hexToRgb,
  hslToRgb,
  oklchToRgb,
  parseOklch,
  rgbToOklch,
  toHex,
} from "../src/color.ts";

test("black on white is the maximum ratio", () => {
  const ratio = contrast({ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 });
  assert.ok(Math.abs(ratio - 21) < 0.01, `expected 21, got ${ratio}`);
});

test("contrast is symmetric", () => {
  const a = hexToRgb("#1d4ed8");
  const b = hexToRgb("#fcfcfb");
  assert.equal(contrast(a, b).toFixed(4), contrast(b, a).toFixed(4));
});

test("hex survives a round trip through OKLCH", () => {
  for (const hex of ["#1d4ed8", "#b45309", "#0a0a0a", "#ffffff", "#7f3fbf"]) {
    assert.equal(toHex(oklchToRgb(rgbToOklch(hexToRgb(hex)))), hex);
  }
});

test("HSL matches the sRGB values it names", () => {
  assert.equal(toHex(hslToRgb(0, 100, 50)), "#ff0000");
  assert.equal(toHex(hslToRgb(210, 100, 50)), "#0080ff");
  assert.equal(toHex(hslToRgb(40, 20, 99)), "#fdfdfc");
});

test("parseOklch reads both the decimal and percent lightness forms", () => {
  assert.deepEqual(parseOklch("oklch(0.45 0.15 262)"), {
    L: 0.45,
    C: 0.15,
    h: 262,
  });
  assert.deepEqual(parseOklch("oklch(45% 0.15 262)"), {
    L: 0.45,
    C: 0.15,
    h: 262,
  });
  assert.equal(parseOklch("var(--ink)"), null);
});

test("formatOklch round-trips through parseOklch", () => {
  const colour = { L: 0.4885, C: 0.2062, h: 264.05 };
  assert.deepEqual(parseOklch(formatOklch(colour)), colour);
});

test("a flattened tint measures worse than the colour it tints", () => {
  const ink = hexToRgb("#171717");
  const bg = hexToRgb("#ffffff");
  const solid = contrast(ink, bg);
  const tinted = contrast(flatten(ink, bg, 0.55), bg);
  assert.ok(
    tinted < solid,
    `tint ${tinted.toFixed(2)} should be under solid ${solid.toFixed(2)}`,
  );
  // The /55 tint from the old palette: the reason the AA floor is /65.
  assert.ok(tinted < 4.5, `expected the /55 tint to fail AA, got ${tinted}`);
});
