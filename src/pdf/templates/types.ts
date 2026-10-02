import type { ReactElement } from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import type { FontId } from '../fonts';
import type { RenderModel } from '../model';

export interface TemplateTheme {
  /** Brand accent as chosen by the user. */
  accent: string;
  /** Text color to use on an accent background. */
  onAccent: string;
  /** Accent darkened when needed so it is readable as text on white. */
  accentInk: string;
  /** Very light accent tint for panels. */
  accentSoft: string;
  /** Light accent tint for borders and dividers. */
  accentLine: string;
  /** Accent lightened when needed so it is readable on dark backgrounds. */
  accentBright: string;
  ink: string;
  body: string;
  muted: string;
  faint: string;
  line: string;
  surface: string;
  fonts: { body: string; heading: string; mono: string };
  /** Page width in points (A4 595.28, Letter 612). */
  pageWidth: number;
  pageHeight: number;
}

export interface TemplateProps {
  model: RenderModel;
  theme: TemplateTheme;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  tags: string[];
  /** Accent used in gallery previews before the user picks their own. */
  defaultAccent: string;
  fonts: { body: FontId; heading: FontId; mono: FontId };
  /** Must return a react-pdf <Document>. */
  render: (props: TemplateProps) => ReactElement<DocumentProps>;
}
