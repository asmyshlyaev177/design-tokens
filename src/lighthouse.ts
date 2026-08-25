/**
 * One Lighthouse audit of one URL, for Playwright suites. Peers are optional
 * and imported lazily so a CSS-only consumer installs no Chromium tooling.
 */

/** Lighthouse category id -> minimum score. */
export type Thresholds = Record<string, number>;

/** Loose on purpose: pinning it breaks on a consumer's different Lighthouse major. */
export type Lhr = any;

export interface AuditOptions {
  /** Absolute URL to audit. */
  url: string;
  thresholds: Thresholds;
  /** Categories to *run*. Defaults to the threshold keys; pass explicitly
   *  when a page is held to fewer categories than it should run. */
  categories?: string[];
  /** CDP port. Defaults to 9333 + worker index, so workers cannot collide. */
  port?: number;
  /** Defaults to desktop: the mobile default's 4x CPU slowdown measures the runner. */
  config?: object;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
  disableLogs?: boolean;
}

export interface AuditResult {
  lhr: Lhr;
  artifacts: unknown;
}

/** Throws if any threshold is missed. Returns `lhr` for per-audit assertions. */
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

  // Lighthouse needs a CDP port that Playwright's `page` fixture does not expose.
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

/** The four categories every consuming site runs. */
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
