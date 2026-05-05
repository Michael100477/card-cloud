/**
 * Downloads the Tesseract English language model into tessdata/.
 * Run once after cloning: node scripts/download-tessdata.mjs
 */
import { createWriteStream, mkdirSync } from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir  = path.join(__dirname, "..", "tessdata");
const outFile = path.join(outDir, "eng.traineddata.gz");
const url     = "https://tessdata.projectnaptha.com/4.0.0_best/eng.traineddata.gz";

mkdirSync(outDir, { recursive: true });

console.log("Downloading Tesseract English language model (~10 MB)…");
const file = createWriteStream(outFile);
https.get(url, res => {
  res.pipe(file);
  file.on("finish", () => { file.close(); console.log("Done → tessdata/eng.traineddata.gz"); });
}).on("error", err => { console.error("Download failed:", err.message); process.exit(1); });
