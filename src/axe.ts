/**
 * axe-core over a Playwright page, for the rules a contrast audit does not
 * cover. The peer is optional and imported lazily, so a CSS-only consumer
 * installs no browser tooling.
 */

/** Minimal structural type, so the package does not import Playwright to be typed. */
export interface AxeTargetPage {
  url(): string;
}

export interface AxeNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

export interface AxeResult {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: AxeNode[];
}

/**
 * WCAG 2.0, 2.1 and 2.2 at A and AA. axe also ships best-practice, experimental
 * and AAA rules; those are opinions, and a gate that fails on an opinion gets
 * turned off.
 */
export const WCAG_AA_TAGS: string[] = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

/**
 * Superseded by `auditContrast`, which scores the same nodes against APCA as
 * well as WCAG 2, walks both themes, settles animations first, and reports what
 * it could not resolve instead of dropping it. Leaving axe's version on
 * duplicates every finding and contradicts it wherever the two disagree.
 * Pass `disableRules` to replace this list — spread it back in to extend it.
 */
/**
 * The WCAG set plus axe's `best-practice` rules: the landmark structure checks
 * (`region`, `landmark-unique`, `landmark-no-duplicate-*`), `focus-order-semantics`
 * and `page-has-heading-one`. Not required by any conformance level, and the
 * failures they catch are real — two unlabelled `<nav>` landmarks read as
 * "navigation" twice with nothing to tell them apart.
 */
export const COMPREHENSIVE_TAGS: string[] = [...WCAG_AA_TAGS, "best-practice"];

export const SUPERSEDED_RULES: string[] = [
  "color-contrast",
  "color-contrast-enhanced",
];

export interface AxeAuditOptions {
  /** Selectors to confine the scan to. Each is a separate root. */
  include?: string[];
  exclude?: string[];
  tags?: string[];
  /** Replaces `SUPERSEDED_RULES`; it is not merged with it. */
  disableRules?: string[];
}

export interface AxeQuery {
  tags: string[];
  disabled: string[];
}

export const axeQuery = ({
  tags,
  disableRules,
}: AxeAuditOptions = {}): AxeQuery => ({
  tags: tags ?? WCAG_AA_TAGS,
  disabled: disableRules ?? SUPERSEDED_RULES,
});

export interface A11yScan {
  violations: AxeResult[];
  /**
   * Rules axe could not decide. Surfaced rather than dropped: most suites
   * assert on violations alone, and this is where axe puts text over a
   * background image, a partially obscured element, and anything below the fold.
   */
  incomplete: AxeResult[];
  /** Rules that ran and passed, so a suite can prove it audited something. */
  passes: number;
}

export async function auditA11y(
  page: AxeTargetPage,
  options: AxeAuditOptions = {},
): Promise<A11yScan> {
  // Named, not default: the package ships one CJS declaration for both
  // conditions, so `default` types as the module namespace under nodenext.
  const { AxeBuilder } = await import("@axe-core/playwright");
  const { tags, disabled } = axeQuery(options);

  let builder = new AxeBuilder({ page: page as never })
    .withTags(tags)
    .disableRules(disabled);

  // One call per selector: an array argument is a frame chain, not a set of roots.
  for (const selector of options.include ?? [])
    builder = builder.include(selector);
  for (const selector of options.exclude ?? [])
    builder = builder.exclude(selector);

  const { violations, incomplete, passes } = await builder.analyze();
  return {
    violations: violations as AxeResult[],
    incomplete: incomplete as AxeResult[],
    passes: passes.length,
  };
}

export const describeViolation = (v: AxeResult): string =>
  [
    `${v.id} (${v.impact ?? "no impact"}) — ${v.help}`,
    ...v.nodes.map(
      (n) =>
        `    ${n.target.join(" ")} — ${(n.failureSummary ?? "").replace(/\s+/g, " ").trim()}`,
    ),
    `    ${v.helpUrl}`,
  ].join("\n");
