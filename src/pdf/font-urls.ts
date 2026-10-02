const fontUrls = import.meta.glob('./fonts/*.ttf', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** URL of a bundled font file, e.g. "inter-400.ttf". */
export function resolveFontUrl(file: string): string {
  return fontUrls[`./fonts/${file}`];
}
