/**
 * OKLCH <-> sRGB and the WCAG contrast ratio: tokens are authored in OKLCH,
 * the AA floor is defined in sRGB luminance. Ottosson OKLab matrices.
 */

/** sRGB channels, each 0..1. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Perceptual lightness 0..1, chroma, hue in degrees. */
export interface Oklch {
  L: number;
  C: number;
  h: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) =>
    lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4) };
}

export function hexToRgb(hex: string): Rgb {
  const v = hex.replace("#", "");
  const full =
    v.length === 3
      ? v
          .split("")
          .map((c) => c + c)
          .join("")
      : v;
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.hypot(A, B);
  const h = C < 1e-6 ? 0 : (Math.atan2(B, A) * 180) / Math.PI;
  return { L, C, h: h < 0 ? h + 360 : h };
}

export function oklchToRgb({ L, C, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const A = C * Math.cos(hr);
  const B = C * Math.sin(hr);

  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;

  return {
    r: clamp01(
      linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    ),
    g: clamp01(
      linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    ),
    b: clamp01(
      linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    ),
  };
}

/** Parses `oklch(0.235 0.03 262)` / `oklch(23.5% 0.03 262)`. */
export function parseOklch(value: string): Oklch | null {
  const m = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i.exec(value);
  if (!m) return null;
  const raw = m[1]!;
  return {
    L: raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw),
    C: parseFloat(m[2]!),
    h: parseFloat(m[3]!),
  };
}

export const formatOklch = ({ L, C, h }: Oklch): string =>
  `oklch(${+L.toFixed(4)} ${+C.toFixed(4)} ${+h.toFixed(2)})`;

export const toHex = ({ r, g, b }: Rgb): string =>
  "#" +
  [r, g, b]
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

const relativeLuminance = ({ r, g, b }: Rgb) =>
  0.2126 * srgbToLinear(r) +
  0.7152 * srgbToLinear(g) +
  0.0722 * srgbToLinear(b);

/** WCAG 2.1 contrast ratio, 1..21. Argument order does not matter. */
export function contrast(rgbA: Rgb, rgbB: Rgb): number {
  const a = relativeLuminance(rgbA);
  const b = relativeLuminance(rgbB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Flattens a tint over its ground, as `color-mix(… N%, transparent)` renders. */
export const flatten = (fg: Rgb, bg: Rgb, alpha: number): Rgb => ({
  r: fg.r * alpha + bg.r * (1 - alpha),
  g: fg.g * alpha + bg.g * (1 - alpha),
  b: fg.b * alpha + bg.b * (1 - alpha),
});

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
