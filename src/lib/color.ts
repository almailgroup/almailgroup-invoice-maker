export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function isHexColor(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 79, g: 70, b: 229 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const to = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function normalizeHex(hex: string, fallback = '#4f46e5'): string {
  return isHexColor(hex) ? rgbToHex(hexToRgb(hex)) : fallback;
}

/** Mixes `color` with `other`; amount 0 = color, 1 = other. */
export function mix(color: string, other: string, amount: number): string {
  const a = hexToRgb(color);
  const b = hexToRgb(other);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

export const tint = (color: string, amount: number) => mix(color, '#ffffff', amount);
export const shade = (color: string, amount: number) => mix(color, '#000000', amount);

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: string): number {
  const { r, g, b } = hexToRgb(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string, dark = '#111827', light = '#ffffff'): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}

/**
 * Returns a version of `color` dark enough to be used for text on white
 * (contrast >= 4.5). Light accents (e.g. yellow) get darkened.
 */
export function textSafe(color: string, background = '#ffffff'): string {
  let c = normalizeHex(color);
  for (let i = 0; i < 20 && contrastRatio(c, background) < 4.5; i++) c = shade(c, 0.1);
  return c;
}

/** Lightens `color` until it reads well on a dark `background` (contrast >= 4.5). */
export function lightSafe(color: string, background = '#0f172a'): string {
  let c = normalizeHex(color);
  for (let i = 0; i < 20 && contrastRatio(c, background) < 4.5; i++) c = tint(c, 0.12);
  return c;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): RGB {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const conv = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: conv(hue + 1 / 3) * 255, g: conv(hue) * 255, b: conv(hue - 1 / 3) * 255 };
}

/** Rotates the hue of `color` by `degrees`, keeping saturation and lightness. */
export function shiftHue(color: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(color));
  return rgbToHex(hslToRgb({ ...hsl, h: hsl.h + degrees }));
}
