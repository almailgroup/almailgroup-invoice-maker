/**
 * Renders every template with sample data to PDF (and PNG previews when
 * poppler's pdftoppm is installed). Useful when designing templates:
 *
 *   npx tsx --tsconfig tsconfig.app.json scripts/render-templates.tsx [outDir] [templateId]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderToFile } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { registerFonts } from '../src/pdf/fonts';
import { buildRenderModel } from '../src/pdf/model';
import { createPdfElement } from '../src/pdf/element';
import { TEMPLATES } from '../src/pdf/templates';
import { sampleClient, sampleCompany, sampleDocument, sampleLongItems } from '../src/pdf/sample';

const outDir = resolve(process.argv[2] ?? 'template-previews');
const only = process.argv[3];
const logoPath = process.env.SAMPLE_LOGO ?? resolve('scripts/assets/sample-logo.png');
const onlyVariants = process.env.VARIANTS?.split(',');
const resolution = process.env.DPI ?? '80';
mkdirSync(outDir, { recursive: true });

const fontDir = resolve('src/pdf/fonts');
const resolveFont = (file: string) => join(fontDir, file);

const company = sampleCompany();
if (logoPath && existsSync(logoPath)) {
  company.branding.logo = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;
}
const client = sampleClient(company.id);
const qr = await QRCode.toDataURL(company.payment.paymentLink, { margin: 0, width: 240 });

const variants = [
  { name: 'invoice', doc: sampleDocument(company, client, 'invoice') },
  {
    name: 'paid',
    doc: sampleDocument(company, client, 'invoice', {
      status: 'paid',
      totals: { subtotal: 0, discount: 0, taxTotal: 0, total: 0, paid: 9428.7, balance: 0 },
    }),
  },
  { name: 'quote', doc: sampleDocument(company, client, 'quote') },
  { name: 'long', doc: sampleDocument(company, client, 'invoice', { items: sampleLongItems() }) },
];

for (const template of TEMPLATES) {
  if (only && template.id !== only) continue;
  for (const variant of variants) {
    if (onlyVariants && !onlyVariants.includes(variant.name)) continue;
    const model = buildRenderModel(variant.doc, company, client, {
      qrCode: qr,
      accent: template.defaultAccent,
    });
    const { element, fonts } = createPdfElement(model, template.id);
    registerFonts(fonts, resolveFont);
    const file = join(outDir, `${template.id}-${variant.name}.pdf`);
    const t0 = Date.now();
    await renderToFile(element, file);
    console.log(`${template.id}-${variant.name}: ${Date.now() - t0}ms`);
    try {
      execFileSync('pdftoppm', ['-png', '-r', resolution, file, file.replace(/\.pdf$/, '')]);
    } catch {
      // pdftoppm not installed; PDFs only.
    }
  }
}
