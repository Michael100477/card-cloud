// Instrumentation placeholder — Tesseract pre-warm removed.
// tesseract.js has a module resolution conflict with Next.js's bundler
// (worker script path resolves to wrong directory in server context).
// OCR is handled via a child_process spawn in lib/ocr.ts instead.
export async function register() {}
