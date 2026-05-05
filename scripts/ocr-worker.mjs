/**
 * Standalone OCR worker — runs as a plain Node.js child process.
 * Spawned by lib/ocr.ts so tesseract.js never runs inside Next.js's
 * bundler, which breaks its internal worker-script path resolution.
 *
 * Usage (called automatically by lib/ocr.ts):
 *   node scripts/ocr-worker.mjs <base64-encoded-image>
 *
 * Writes JSON to stdout: { text: string } | { error: string }
 */

import { createWorker } from "tesseract.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const base64Image = process.argv[2];
if (!base64Image) {
  process.stdout.write(JSON.stringify({ error: "No image data provided" }));
  process.exit(1);
}

try {
  const imageBuffer = Buffer.from(base64Image, "base64");

  const worker = await createWorker("eng", 1, {
    langPath: path.join(projectRoot, "tessdata"),
    logger: () => {},
  });

  await worker.setParameters({
    tessedit_char_whitelist:
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-./ ",
  });

  const { data } = await worker.recognize(imageBuffer);
  await worker.terminate();

  process.stdout.write(JSON.stringify({ text: data.text }));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err) }));
  process.exit(1);
}
