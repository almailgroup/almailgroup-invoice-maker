/// <reference lib="webworker" />
import './buffer-shim';
import { pdf } from '@react-pdf/renderer';
import { registerFonts } from './fonts';
import { createPdfElement } from './element';
import { resolveFontUrl } from './font-urls';
import type { RenderModel } from './model';

export interface PdfRequest {
  id: number;
  model: RenderModel;
  templateId: string | null;
}

export type PdfResponse =
  { id: number; ok: true; buffer: ArrayBuffer } | { id: number; ok: false; error: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<PdfRequest>) => {
  const { id, model, templateId } = event.data;
  try {
    const { element, fonts } = createPdfElement(model, templateId);
    registerFonts(fonts, resolveFontUrl);
    const blob = await pdf(element).toBlob();
    const buffer = await blob.arrayBuffer();
    scope.postMessage({ id, ok: true, buffer } satisfies PdfResponse, [buffer]);
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies PdfResponse);
  }
};
