/// <reference lib="dom" />
/**
 * Rendered-DOM contrast audit for Playwright. Lighthouse checks light mode
 * only, skips text-free nodes and never opens a modal; this walks whatever is
 * on screen and scores it against both models. Rationale in CLAUDE.md.
 */
import { AA_LARGE, AA_NORMAL, contrast, type Rgb } from "./color.ts";
import { lc, LC_LARGE, LC_UI } from "./apca.ts";

/** Minimal structural type, so the package does not import Playwright to be typed. */
export interface EvaluatablePage {
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>;
}

/**
 * Reveal-on-scroll transitions read as invisible text mid-fade, and
 * `reducedMotion: "reduce"` does not reliably pin them. Infinite animations
 * are left alone — they never finish.
 */
async function settleAnimations(page: EvaluatablePage): Promise<void> {
  await page.evaluate(
    () =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ).then(() => undefined),
    null,
  );
}

export interface ContrastSample {
  /** Text pixel after alpha and inherited opacity, 0..255. */
  color: [number, number, number];
  /** Opaque background pixel under the text, 0..255. */
  background: [number, number, number];
  fontSize: number;
  fontWeight: number;
  text: string;
  selector: string;
}

export interface ContrastTier {
  minRatio: number;
  minLc: number;
}

/**
 * The floor is the weakest the contract grants any token at that size, so a
 * finding means a page used the wrong token — the ramp's own quality is
 * `check-tokens`' job. See CLAUDE.md.
 */
export const DEFAULT_TIERS: { large: ContrastTier; normal: ContrastTier } = {
  large: { minRatio: AA_LARGE, minLc: LC_UI },
  normal: { minRatio: AA_NORMAL, minLc: LC_LARGE },
};

export interface ContrastScan {
  samples: ContrastSample[];
  /** Nodes skipped because an image or gradient sat under the text. */
  unresolved: number;
}

export interface CollectOptions {
  /** CSS selectors whose subtrees are skipped. */
  ignore?: string[];
  /** Root to walk. Defaults to the document. */
  root?: string;
}

export interface ContrastFinding {
  sample: ContrastSample;
  ratio: number;
  lc: number;
  tier: "large" | "normal";
  passes: boolean;
}

const scale = ([r, g, b]: [number, number, number]): Rgb => ({
  r: r / 255,
  g: g / 255,
  b: b / 255,
});

/** WCAG's large-text definition, in used pixels. */
const isLarge = ({ fontSize, fontWeight }: ContrastSample): boolean =>
  fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

export function scoreContrast(
  samples: ContrastSample[],
  tiers: { large: ContrastTier; normal: ContrastTier } = DEFAULT_TIERS,
): ContrastFinding[] {
  return samples.map((sample) => {
    const tier = isLarge(sample) ? "large" : "normal";
    const { minRatio, minLc } = tiers[tier];
    const fg = scale(sample.color);
    const bg = scale(sample.background);
    const ratio = contrast(fg, bg);
    const lcValue = lc(fg, bg);
    return {
      sample,
      ratio,
      lc: lcValue,
      tier,
      passes: ratio >= minRatio && lcValue >= minLc,
    };
  });
}

export const contrastFailures = (
  findings: ContrastFinding[],
): ContrastFinding[] => findings.filter((f) => !f.passes);

export const describeContrast = (f: ContrastFinding): string => {
  const { selector, fontSize, fontWeight, text } = f.sample;
  const parts: string[] = [];
  const { minRatio, minLc } = DEFAULT_TIERS[f.tier];
  if (f.ratio < minRatio) {
    parts.push(`WCAG ${f.ratio.toFixed(2)}:1 < ${minRatio}:1`);
  }
  if (f.lc < minLc) parts.push(`APCA Lc ${f.lc.toFixed(0)} < ${minLc}`);
  const px = `${fontSize.toFixed(0)}px/${fontWeight}`;
  return `${selector} (${px}, ${f.tier}) — ${parts.join(", ")} — ${JSON.stringify(text)}`;
};

/**
 * Colours are composited by the browser's own canvas rather than parsed, so
 * every CSS colour syntax resolves without a parser to keep in step.
 * Text over an image or gradient is skipped: the pixel under it is unknowable
 * from computed style alone.
 */
export async function collectContrast(
  page: EvaluatablePage,
  options: CollectOptions = {},
): Promise<ContrastScan> {
  await settleAnimations(page);
  return page.evaluate((opts: CollectOptions) => {
    const ignore = opts.ignore ?? [];
    const scope = opts.root
      ? document.querySelector(opts.root)
      : document.documentElement;
    if (!scope) throw new Error(`contrast: root ${opts.root} not found`);

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("contrast: no 2d context");

    const paint = (css: string, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
    };

    const readPixel = (): [number, number, number] => {
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    };

    /** Via canvas, so `rgba()`, `color()` and `oklch()` all answer alike. */
    const alphaOf = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      paint(css, 1);
      return ctx.getImageData(0, 0, 1, 1).data[3]! / 255;
    };

    const hasOwnText = (el: Element) =>
      [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      );

    const ownText = (el: Element) =>
      [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    const selectorFor = (el: Element) => {
      const path: string[] = [];
      for (
        let n: Element | null = el;
        n && path.length < 4;
        n = n.parentElement
      ) {
        const id = n.id ? `#${n.id}` : "";
        const cls = [...n.classList]
          .slice(0, 2)
          .map((c) => `.${c}`)
          .join("");
        path.unshift(`${n.tagName.toLowerCase()}${id}${cls}`);
        if (id) break;
      }
      return path.join(">");
    };

    const samples: ContrastSample[] = [];
    let unresolved = 0;

    for (const el of scope.querySelectorAll("*")) {
      if (!hasOwnText(el)) continue;
      if (ignore.some((sel) => el.closest(sel))) continue;

      const rect = el.getBoundingClientRect();
      // Visually-hidden text is clipped to about a pixel; it is not read.
      if (rect.width * rect.height < 4) continue;

      const style = getComputedStyle(el);
      if (style.visibility !== "visible") continue;
      if (style.webkitTextFillColor === "rgba(0, 0, 0, 0)") continue;

      let opacity = 1;
      let sealed = false;
      let overArt = false;
      const stack: string[] = [];

      for (let n: Element | null = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        const own = Number(s.opacity);
        opacity *= own;
        if (sealed) continue;
        if (s.backgroundImage !== "none") overArt = true;
        const bg = s.backgroundColor;
        const alpha = alphaOf(bg) * own;
        if (alpha === 0) continue;
        stack.push(bg);
        if (alpha >= 1) sealed = true;
      }
      if (overArt) unresolved++;
      if (overArt || opacity === 0) continue;

      // The page's ultimate backdrop is the canvas colour, white everywhere.
      ctx.clearRect(0, 0, 1, 1);
      paint("#ffffff", 1);
      for (const layer of stack.reverse()) paint(layer, 1);
      const background = readPixel();

      paint(style.color, opacity);
      const color = readPixel();

      samples.push({
        color,
        background,
        fontSize: parseFloat(style.fontSize),
        fontWeight: Number(style.fontWeight),
        text: ownText(el).slice(0, 60),
        selector: selectorFor(el),
      });
    }
    return { samples, unresolved };
  }, options);
}

export interface AuditContrastOptions extends CollectOptions {
  tiers?: { large: ContrastTier; normal: ContrastTier };
}

/** Collect and score in one call. Returns every node, passing and failing. */
export async function auditContrast(
  page: EvaluatablePage,
  { tiers, ...collect }: AuditContrastOptions = {},
): Promise<{ findings: ContrastFinding[]; unresolved: number }> {
  const { samples, unresolved } = await collectContrast(page, collect);
  return { findings: scoreContrast(samples, tiers), unresolved };
}
