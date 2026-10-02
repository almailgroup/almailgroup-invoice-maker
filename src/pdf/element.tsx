import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import type { FontId } from './fonts';
import type { RenderModel } from './model';
import { getTemplate } from './templates';
import { buildTheme, templateFontIds } from './templates/theme';

/** Builds the react-pdf element for a model and lists the fonts it needs. */
export function createPdfElement(
  model: RenderModel,
  templateId: string | null | undefined,
): { element: ReactElement<DocumentProps>; fonts: FontId[] } {
  const template = getTemplate(templateId);
  const theme = buildTheme(template, model);
  return {
    element: template.render({ model, theme }),
    fonts: templateFontIds(template, model.fontId),
  };
}
