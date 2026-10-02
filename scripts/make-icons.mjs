// Renders the PNG app icons in public/icons/ from public/favicon.svg.
// Usage: node scripts/make-icons.mjs  (uses Playwright's Chromium)
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/icons');
const favicon = readFileSync(join(root, 'public/favicon.svg'), 'utf8');

// The favicon is a rounded square (first <rect>) with the glyph on top.
const background = favicon.match(/<rect[^>]*fill="(#[0-9a-fA-F]{3,8})"/)?.[1];
const glyph = favicon.replace(/^[\s\S]*?<rect[^>]*\/>/, '').replace(/<\/svg>\s*$/, '');
if (!background || !glyph.trim()) throw new Error('Unexpected favicon.svg structure');

// Full-bleed square with the glyph scaled into the given share of the canvas.
// Maskable icons must keep their content inside the central 80% circle.
const square = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${background}"/>
  <g transform="translate(32 32) scale(${scale}) translate(-31 -34)">${glyph}</g>
</svg>`;

const icons = [
  { file: 'icon-192.png', size: 192, svg: favicon },
  { file: 'icon-512.png', size: 512, svg: favicon },
  { file: 'maskable-512.png', size: 512, svg: square(0.8) },
  { file: 'apple-touch-icon.png', size: 180, svg: square(1) },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const { file, size, svg } of icons) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    await page.screenshot({
      path: join(outDir, file),
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`public/icons/${file}`);
  }
} finally {
  await browser.close();
}
