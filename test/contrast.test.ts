import assert from "node:assert/strict";

import { test } from "vitest";

import {
  DEFAULT_TIERS,
  contrastFailures,
  describeContrast,
  scoreContrast,
  type ContrastSample,
} from "../src/contrast.ts";

const sample = (over: Partial<ContrastSample> = {}): ContrastSample => ({
  color: [0, 0, 0],
  background: [255, 255, 255],
  fontSize: 16,
  fontWeight: 400,
  text: "hello",
  selector: "main>p",
  ...over,
});

test("black on white passes at every size", () => {
  const [body, heading] = scoreContrast([
    sample(),
    sample({ fontSize: 32, fontWeight: 700 }),
  ]);
  assert.equal(body!.tier, "normal");
  assert.equal(heading!.tier, "large");
  assert.ok(body!.passes && heading!.passes);
});

test("WCAG's large-text definition decides the tier", () => {
  const tiers = (s: Partial<ContrastSample>) =>
    scoreContrast([sample(s)])[0]!.tier;
  assert.equal(tiers({ fontSize: 24 }), "large");
  assert.equal(tiers({ fontSize: 23 }), "normal");
  assert.equal(tiers({ fontSize: 18.66, fontWeight: 700 }), "large");
  assert.equal(tiers({ fontSize: 18.66, fontWeight: 600 }), "normal");
});

test("a token that clears WCAG but not APCA still fails", () => {
  // The dark --faint the sites shipped: 7.09:1 (past AA) at Lc 49.
  const [f] = scoreContrast([
    sample({ color: [154, 154, 158], background: [25, 25, 29] }),
  ]);
  assert.ok(f!.ratio >= DEFAULT_TIERS.normal.minRatio);
  assert.ok(f!.lc < DEFAULT_TIERS.normal.minLc);
  assert.equal(f!.passes, false);
  assert.match(describeContrast(f!), /APCA Lc \d+ < 60/);
  assert.equal(contrastFailures([f!]).length, 1);
});

test("the same pair passes once it is large", () => {
  const [f] = scoreContrast([
    sample({ color: [154, 154, 158], background: [25, 25, 29], fontSize: 28 }),
  ]);
  assert.ok(f!.passes);
});
