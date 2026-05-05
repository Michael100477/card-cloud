/**
 * Next.js instrumentation hook — runs once when the server starts.
 * We use it to pre-load the Tesseract.js English language model (~4 MB)
 * so it's already cached by the time a user first tries Scan Slab.
 * Without this, the first scan blocks while downloading from CDN.
 */
export async function register() {
  // Only run in Node.js runtime (not Edge), and only when OCR is relevant
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("[OCR] Pre-loading Tesseract language model…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: () => {} });
      await worker.terminate();
      console.log("[OCR] Tesseract ready — language model cached.");
    } catch (err) {
      // Non-fatal — scans still work, just the first one will be slower
      console.warn("[OCR] Pre-load failed (non-fatal):", err);
    }
  }
}
