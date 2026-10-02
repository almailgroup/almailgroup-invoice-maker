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
