/**
 * Template names and descriptions. Kept separate from the templates themselves
 * so pages can list templates without loading the PDF renderer.
 */
export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Accent used in gallery previews before the user picks their own. */
  defaultAccent: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: 'modern',
    name: 'Modern',
    description: 'Crisp layout with an accent summary panel and a highlighted amount due.',
    tags: ['Popular', 'Clean'],
    defaultAccent: '#4f46e5',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Quiet, typographic and spacious — hairline rules with a single touch of colour.',
    tags: ['Clean', 'Monochrome'],
    defaultAccent: '#0f766e',
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Structured and businesslike, with a bold title block and boxed details.',
    tags: ['Business', 'Structured'],
    defaultAccent: '#1d4ed8',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Refined serif letterhead with fine double rules — ideal for premium services.',
    tags: ['Serif', 'Premium'],
    defaultAccent: '#a16207',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Big, confident type with a dark summary band — makes the amount due impossible to miss.',
    tags: ['Striking', 'Dark'],
    defaultAccent: '#f97316',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional boxed layout with ruled tables — familiar to every accounts department.',
    tags: ['Traditional', 'Structured'],
    defaultAccent: '#0e7490',
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Playful geometric accents and rounded cards — friendly but still professional.',
    tags: ['Colorful', 'Friendly'],
    defaultAccent: '#db2777',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Dense, efficient layout that fits many line items per page — great for itemised services.',
    tags: ['Many items', 'Efficient'],
    defaultAccent: '#2563eb',
  },
  {
    id: 'gradient',
    name: 'Gradient',
    description: 'Vibrant gradient header in your brand colour, with the logo on a clean white card.',
    tags: ['Colorful', 'Modern'],
    defaultAccent: '#7c3aed',
  },
  {
    id: 'mono',
    name: 'Mono',
    description: 'Technical look with a dark header, grid lines and monospaced figures.',
    tags: ['Technical', 'Dark'],
    defaultAccent: '#10b981',
  },
];

export const DEFAULT_TEMPLATE_ID = 'modern';

export function templateMeta(id: string): TemplateMeta {
  const meta = TEMPLATE_META.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown template ${id}`);
  return meta;
}
