/**
 * react-pdf calls `Buffer.isBuffer()` after loading each image. Browsers have no
 * `Buffer`, so the call throws, the image's cache key is never set, and
 * different images (logo, QR code) end up sharing one cache entry. A minimal
 * stand-in fixes that. Only loaded where PDFs are rendered.
 */
const scope = globalThis as { Buffer?: unknown };
if (typeof scope.Buffer === 'undefined') {
  scope.Buffer = { isBuffer: () => false };
}

export {};
