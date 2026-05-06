"""
PaddleOCR worker for slab label text extraction.
Reads a base64-encoded image from stdin, runs PaddleOCR, writes JSON to stdout.
Called by lib/ocr.ts as a child process.

PaddleOCR advantages over Tesseract:
  - Built-in angle/direction classification (handles rotated labels)
  - Much higher accuracy on structured printed text
  - Better at detecting text regions automatically
  - Free, self-hosted, no per-scan cost
"""

import sys
import json
import base64
import io

def main():
    try:
        # Read base64 image from stdin
        raw = sys.stdin.buffer.read().strip()
        if not raw:
            print(json.dumps({"error": "No image data received"}))
            sys.exit(1)

        image_bytes = base64.b64decode(raw)

        # Import here so startup errors are caught cleanly
        from paddleocr import PaddleOCR
        from PIL import Image
        import numpy as np

        # Load image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(img)

        # Run PaddleOCR
        # use_angle_cls=True: auto-detects rotated text (critical for sideways slabs)
        # lang='en': English text
        # show_log=False: suppress verbose output
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        result = ocr.ocr(img_array, cls=True)

        # Extract all text lines, ordered by vertical position
        lines = []
        if result and result[0]:
            for item in result[0]:
                if item and len(item) >= 2:
                    box  = item[0]   # bounding box [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                    text_conf = item[1]  # (text, confidence)
                    if text_conf and len(text_conf) >= 2:
                        text = text_conf[0]
                        conf = text_conf[1]
                        if conf > 0.5 and text.strip():  # only confident detections
                            # Use top-left y coordinate for ordering
                            y_pos = min(p[1] for p in box) if box else 0
                            lines.append((y_pos, text.strip()))

        # Sort by vertical position (top → bottom)
        lines.sort(key=lambda x: x[0])
        full_text = "\n".join(line[1] for line in lines)

        print(json.dumps({"text": full_text}))

    except ImportError as e:
        print(json.dumps({"error": f"PaddleOCR not installed: {e}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
