/**
 * Standalone OCR worker — runs as a plain Node.js child process.
 * Reads base64-encoded image from stdin, writes JSON result to stdout.
 * Spawned by lib/ocr.ts so tesseract.js never runs inside Next.js's
 * bundler, which breaks its internal worker-script path resolution.
 *
 * Reads image from stdin (not argv) to avoid Windows' 32,767-char
 * command-line argument limit.
 */

import { createWorker } from "tesseract.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Read entire stdin as the base64 image
let base64Image = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  base64Image += chunk;
}

base64Image = base64Image.trim();
if (!base64Image) {
  process.stdout.write(JSON.stringify({ error: "No image data received on stdin" }));
  process.exit(1);
}

try {
  const imageBuffer = Buffer.from(base64Image, "base64");

  const worker = await createWorker("eng", 1, {
    langPath: path.join(projectRoot, "tessdata"),
    logger:   () => {},
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
