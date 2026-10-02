import { bold } from './bold';
import { classic } from './classic';
import { compact } from './compact';
import { corporate } from './corporate';
import { creative } from './creative';
import { elegant } from './elegant';
import { gradient } from './gradient';
import { minimal } from './minimal';
import { modern } from './modern';
import { mono } from './mono';
import type { TemplateDefinition } from './types';

export type { TemplateDefinition, TemplateProps, TemplateTheme } from './types';

export const TEMPLATES: TemplateDefinition[] = [
  modern,
  minimal,
  corporate,
  elegant,
  bold,
  classic,
  creative,
  compact,
  gradient,
  mono,
];

export const DEFAULT_TEMPLATE_ID = 'modern';

export function getTemplate(id: string | null | undefined): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
}
