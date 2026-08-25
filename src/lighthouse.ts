/**
 * One Lighthouse audit of one URL, for Playwright suites.
 *
 * Four repositories had grown a byte-for-byte copy of this block — the same
 * CDP port arithmetic, the same desktop config, the same try/finally, and the
 * same three comments explaining why each is necessary. The pages audited and
 * the thresholds they are held to are genuinely per-project; everything below
 * is not.
 *
 * Peer dependencies are optional and imported here rather than at module load,
 * so a project that wants only the CSS never installs Chromium tooling.
 */

/** Lighthouse category id -> minimum score. */
export type Thresholds = Record<string, number>;

/**
 * Lighthouse's own result shape, kept loose on purpose: pinning it would make
 * this package's types fail whenever a consumer runs a different Lighthouse
 * major, for no benefit — callers reach into `lhr` for one audit at a time.
 */
export type Lhr = any;

export interface AuditOptions {
  /** Absolute URL to audit. */
  url: string;
  thresholds: Thresholds;
  /**
   * Categories to *run*. Defaults to the threshold keys, which is
   * playwright-lighthouse's own behaviour — pass this explicitly when a page
   * is held to fewer categories than it should run, or the unheld ones never
   * execute and their audits cannot be inspected.
   */
  categories?: string[];
  /**
   * CDP port. Defaults to 9333 + the worker index, which keeps parallel
   * workers off each other's port.
   */
  port?: number;
  /**
   * Lighthouse config. Defaults to the bundled desktop config: Lighthouse's
   * mobile default applies a 4x CPU slowdown, which turns the performance
   * score into a measurement of the runner rather than of the site.
   */
  config?: object;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  disableLogs?: boolean;
}

export interface AuditResult {
  lhr: Lhr;
  artifacts: unknown;
}

/**
 * Runs the audit and throws if any threshold is missed.
 *
 * @returns the full result, so a caller can assert on individual audits — a
 *   `noindex` page, for instance, is meant to fail `is-crawlable` and nothing
 *   else.
 */
export async function auditPage({
  url,
  thresholds,
  categories,
  port,
  config,
  waitUntil = "networkidle",
  disableLogs = false,
}: AuditOptions): Promise<AuditResult> {
  const [{ chromium, test }, { playAudit }, desktopConfig] = await Promise.all([
    import("@playwright/test"),
    import("playwright-lighthouse"),
    config
      ? Promise.resolve(undefined)
      : import("lighthouse/core/config/desktop-config.js").then(
          (m) => m.default as object,
        ),
  ]);

  // Lighthouse drives the browser over CDP, which needs a debugging port
  // Playwright's own `page` fixture does not expose.
  const cdpPort = port ?? 9333 + (test.info().workerIndex ?? 0);
  const browser = await chromium.launch({
    args: [`--remote-debugging-port=${cdpPort}`],
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil });

    return (await playAudit({
      page,
      port: cdpPort,
      thresholds,
      opts: categories ? { onlyCategories: categories } : undefined,
      config: config ?? desktopConfig,
      disableLogs,
    })) as AuditResult;
  } finally {
    await browser.close();
  }
}

/** The four categories every one of these sites runs. */
export const CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
];

/** @returns ids of the audits in `category` that scored below 1 */
export const failedAudits = (lhr: Lhr, category: string): string[] =>
  lhr.categories[category].auditRefs
    .filter((ref: { id: string }) => (lhr.audits[ref.id]?.score ?? 1) < 1)
    .map((ref: { id: string }) => ref.id);
