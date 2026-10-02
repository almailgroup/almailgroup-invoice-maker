import { modern } from './modern';
import type { TemplateDefinition } from './types';

export type { TemplateDefinition, TemplateProps, TemplateTheme } from './types';

export const TEMPLATES: TemplateDefinition[] = [modern];

export const DEFAULT_TEMPLATE_ID = 'modern';

export function getTemplate(id: string | null | undefined): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID)!;
}
