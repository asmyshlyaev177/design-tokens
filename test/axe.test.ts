import assert from "node:assert/strict";

import { test } from "vitest";

import {
  COMPREHENSIVE_TAGS,
  SUPERSEDED_RULES,
  WCAG_AA_TAGS,
  axeQuery,
  describeViolation,
  type AxeResult,
} from "../src/axe.ts";

test("axe's own contrast rules are off by default", () => {
  // Both would duplicate auditContrast and disagree with it — it also scores APCA.
  assert.deepEqual(axeQuery().disabled, SUPERSEDED_RULES);
  assert.ok(SUPERSEDED_RULES.includes("color-contrast"));
});

test("the default tags are WCAG A and AA, never best-practice or AAA", () => {
  const tags = axeQuery().tags;
  assert.deepEqual(tags, WCAG_AA_TAGS);
  assert.ok(!tags.some((t) => t.endsWith("aaa") || t === "best-practice"));
});

test("the comprehensive set adds best-practice and nothing else", () => {
  assert.deepEqual(COMPREHENSIVE_TAGS, [...WCAG_AA_TAGS, "best-practice"]);
  // AAA stays out: color-contrast-enhanced is superseded by auditContrast, and
  // the rest are aspirational rather than defects.
  assert.ok(!COMPREHENSIVE_TAGS.some((t) => t.endsWith("aaa")));
});

test("disableRules replaces the default rather than merging into it", () => {
  assert.deepEqual(axeQuery({ disableRules: [] }).disabled, []);
  assert.deepEqual(axeQuery({ disableRules: ["region"] }).disabled, ["region"]);
});

const violation = (over: Partial<AxeResult> = {}): AxeResult => ({
  id: "link-name",
  impact: "serious",
  help: "Links must have discernible text",
  helpUrl: "https://dequeuniversity.com/rules/axe/4.12/link-name",
  tags: ["wcag2a", "wcag412"],
  nodes: [
    {
      target: ["nav > a:nth-child(2)"],
      html: '<a href="/x"><svg/></a>',
      failureSummary:
        "Fix any of the following:\n  Element has no title attribute",
    },
  ],
  ...over,
});

test("a violation reports its rule, every node and the help URL", () => {
  const text = describeViolation(violation());
  assert.match(text, /link-name \(serious\)/);
  assert.match(text, /nav > a:nth-child\(2\)/);
  // Multi-line failure summaries are flattened so one finding stays one block.
  assert.ok(!text.includes("\n  Element has no title"));
  assert.match(text, /Element has no title attribute/);
  assert.match(text, /dequeuniversity\.com/);
});

test("a missing impact does not render as undefined", () => {
  assert.match(describeViolation(violation({ impact: null })), /\(no impact\)/);
});
