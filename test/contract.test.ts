/**
 * The contract, checked against the token file this package ships.
 *
 * Every hue currently in use is exercised here as a smoke test, but the real
 * guarantee is the one each consumer runs for itself via `check-tokens` — a
 * project can retune a hue without touching this repository, and a list here
 * would go stale the moment it did.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { checkContract, describe, failures } from "../src/contract.ts";
import { readHues } from "../src/hues.ts";
import { malformedLightDark, parseTokens, resolve } from "../src/parse.ts";
import {
  AA_NORMAL,
  contrast,
  flatten,
  oklchToRgb,
  parseOklch,
} from "../src/color.ts";
import { tokensCss } from "../src/index.ts";

/** Hues in use when this was written; see the note above. */
const IN_USE = {
  portfolio: { brand: 264, accent: 60, neutral: 264 },
  "test-proxy-recorder": { brand: 262, accent: 29, neutral: 262 },
  "react-horizontal-scrolling-menu": { brand: 15, accent: 265, neutral: 15 },
  "state-in-url": { brand: 48, accent: 48, neutral: 48 },
  "x-profile-location": { brand: 183, accent: 183, neutral: 284 },
};

for (const [project, hues] of Object.entries(IN_USE)) {
  test(`the contract holds at ${project}'s hues`, () => {
    const bad = failures(checkContract(tokensCss, hues));
    assert.deepEqual(bad.map(describe), []);
  });
}

test("the contract is checked in both themes on every ground", () => {
  // 7 pairs, 3 of them against all 3 grounds, times 2 themes.
  const results = checkContract(tokensCss);
  assert.equal(results.length, 26);
  assert.equal(new Set(results.map((r) => r.theme)).size, 2);
});

test("the contract holds at every hue on the wheel, not just the five in use", () => {
  // The ramp fixes lightness and chroma per token and varies only hue, so the
  // guarantee is meant to be hue-independent — a new project can pick any
  // angle and inherit it. This is the assertion that says so, and it is the
  // reason the per-project list above is a smoke test rather than the contract.
  const broken = [];
  for (let hue = 0; hue < 360; hue += 5) {
    const bad = failures(
      checkContract(tokensCss, { brand: hue, accent: hue, neutral: hue }),
    );
    const first = bad[0];
    if (first) broken.push(`${hue}deg: ${describe(first)}`);
  }
  assert.deepEqual(broken, []);
});

test("a broken token is reported rather than silently passing", () => {
  // Pins that checkContract measures rather than rubber-stamps: move --muted
  // onto --bg's own lightness and it must fail, in both themes.
  const sabotaged = tokensCss.replace(
    /--muted:[^;]+;/,
    "--muted: light-dark(oklch(0.98 0.001 var(--neutral-hue)), oklch(0.14 0.001 var(--neutral-hue)));",
  );
  const bad = failures(checkContract(sabotaged));
  assert.ok(
    bad.some((r) => r.token === "--muted" && r.theme === "light"),
    "expected a --muted failure in light",
  );
  assert.ok(
    bad.some((r) => r.token === "--muted" && r.theme === "dark"),
    "expected a --muted failure in dark",
  );
});

test("hue knobs are read from a consuming stylesheet, later files winning", () => {
  const base =
    ":root { --brand-hue: 10; --accent-hue: 20; --neutral-hue: 30; }";
  const override = "@theme { --brand-hue: 99; }";
  assert.deepEqual(readHues([base]), { brand: 10, accent: 20, neutral: 30 });
  assert.deepEqual(readHues([base, override]), {
    brand: 99,
    accent: 20,
    neutral: 30,
  });
});

test("a hue knob inside a comment is not mistaken for a declaration", () => {
  const source = "/* --brand-hue: 999; */ :root { --brand-hue: 42; }";
  assert.deepEqual(readHues([source]), { brand: 42 });
});

test("every light-dark() in the shipped file takes exactly two arguments", () => {
  // A shadow is itself a comma-separated list, so wrapping one whole rather
  // than wrapping its colour yields a four-argument call browsers drop —
  // taking that token's dark value with it.
  assert.deepEqual(malformedLightDark(tokensCss), []);
});

test("the theme opt-ins are scoped to the root element", () => {
  // Unscoped, `[data-theme="light"]` matches any element using the attribute
  // for its own purposes. A theme menu labelling its buttons
  // data-theme="light|dark|system" rendered each one in that theme.
  const code = tokensCss.replace(/\/\*[\s\S]*?\*\//g, "");
  const unscoped = [
    ...code.matchAll(/^\s*(\.(?:dark|light)|\[data-theme[^\]]*\])\s*[,{]/gm),
  ];
  assert.deepEqual(
    unscoped.map((m) => m[1]),
    [],
  );
});

test("no token resolves identically in both themes", () => {
  const { light, dark } = parseTokens(tokensCss);
  for (const name of [
    "--bg",
    "--surface",
    "--ink",
    "--muted",
    "--line",
    "--shadow-1",
  ]) {
    assert.notEqual(
      light.get(name),
      dark.get(name),
      `${name} lost its light-dark()`,
    );
  }
});

test("an alpha tint of --ink is not a substitute for --muted", () => {
  // Pins the reason --muted exists: the tints this system replaced measure
  // under AA while looking perfectly reasonable.
  const { light } = parseTokens(tokensCss);
  const rgb = (name: string) => {
    const oklch = parseOklch(resolve(light.get(name) ?? "", light));
    assert.ok(oklch, `${name} did not resolve to a colour`);
    return oklchToRgb(oklch);
  };
  const ink = rgb("--ink");
  const bg = rgb("--bg");
  assert.ok(contrast(flatten(ink, bg, 0.55), bg) < AA_NORMAL);
  assert.ok(contrast(rgb("--muted"), bg) >= AA_NORMAL);
});
