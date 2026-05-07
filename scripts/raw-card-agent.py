"""
Raw Card Recognition Agent.

Uses a local Ollama vision model to identify raw (ungraded) cards from photos.
Reads the card face itself — no grading label needed.

Usage:
  python scripts/raw-card-agent.py --input-dir ./card-photos --model llama3.2-vision:11b
  python scripts/raw-card-agent.py --input-dir ./card-photos --model llava:7b --count 50

Input:
  A folder of card images (JPG, PNG, WEBP).

Output:
  training-raw/{id}.jpg   — copy of the card image
  training-raw/{id}.json  — extracted metadata (player, year, set, etc.)
  Queued in training_examples table for human review.

Requirements:
  Ollama running locally with a vision model installed.
  pip install requests pillow
"""

import argparse
import base64
import json
import os
import sys
import time
import uuid
from pathlib import Path

try:
    import requests
    from PIL import Image
    from io import BytesIO
except ImportError:
    print("Missing dependencies. Run: pip install requests pillow")
    sys.exit(1)

OLLAMA_URL    = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OUTPUT_DIR    = Path(os.environ.get("TRAINING_DATA_PATH",
                     str(Path.home() / "training-data")))
SUPPORTED_EXT = {".jpg", ".jpeg", ".png", ".webp"}

PROMPT = """You are looking at a sports or trading card.
Read any text visible on the CARD FACE ITSELF (ignore any grading slab, label, or holder).
Extract the following:
- player: the player or character name printed on the card
- year: the card year if printed (usually on the front or back)
- manufacturer: the company (Topps, Panini, Upper Deck, Fleer, Score, etc.)
- set: the specific product name (Topps Chrome, Prizm, Bowman, etc.)
- subset: any subset or variation printed on the card face (Refractor, Gold, etc.)
- cardNumber: the card number if visible (e.g. #170)
- sport: Baseball, Football, Basketball, Hockey, Soccer, Pokemon, Magic, etc.
- team: the team name if visible

Return ONLY valid JSON. Use null for fields you cannot read.
Example: {"player":"Bo Jackson","year":1987,"manufacturer":"Topps","set":"Topps","subset":"Future Stars","cardNumber":"170","sport":"Baseball","team":"Kansas City Royals"}"""


def check_ollama(model: str) -> bool:
    """Verify Ollama is running and the model is available."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if r.status_code != 200:
            print(f"✗ Ollama not responding at {OLLAMA_URL}")
            return False
        models = [m["name"] for m in r.json().get("models", [])]
        if model not in models:
            print(f"✗ Model '{model}' not installed. Available: {', '.join(models)}")
            print(f"  Pull it with: ollama pull {model}")
            return False
        return True
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to Ollama at {OLLAMA_URL}. Is it running?")
        return False


def image_to_base64(path: Path) -> str:
    """Load and encode image, resizing if needed."""
    img = Image.open(path).convert("RGB")
    # Resize to max 1568px for Ollama vision models
    if max(img.size) > 1568:
        img.thumbnail((1568, 1568), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def recognize_card(image_b64: str, model: str) -> dict | None:
    """Send image to Ollama and parse the response."""
    try:
        r = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": model, "prompt": PROMPT, "images": [image_b64], "stream": False},
            timeout=60,
        )
        if r.status_code != 200:
            return None

        response_text = r.json().get("response", "")

        # Extract JSON from the response
        start = response_text.find("{")
        end   = response_text.rfind("}") + 1
        if start < 0 or end <= start:
            return None

        return json.loads(response_text[start:end])
    except (requests.RequestException, json.JSONDecodeError, KeyError):
        return None


def save_example(image_path: Path, metadata: dict, source_path: Path) -> None:
    """Save image + metadata to the training output directory."""
    uid      = str(uuid.uuid4())[:8]
    out_img  = OUTPUT_DIR / "training-data" / "raw_card" / f"{uid}.jpg"
    out_meta = OUTPUT_DIR / "training-data" / "raw_card" / f"{uid}.json"

    out_img.parent.mkdir(parents=True, exist_ok=True)

    # Save a JPEG copy
    img = Image.open(source_path).convert("RGB")
    if max(img.size) > 1568:
        img.thumbnail((1568, 1568), Image.LANCZOS)
    img.save(out_img, "JPEG", quality=90)

    metadata["image_file"] = str(out_img)
    metadata["source"]     = "raw_card"
    metadata["source_file"] = str(source_path)

    with open(out_meta, "w") as f:
        json.dump(metadata, f, indent=2)


def run(input_dir: Path, model: str, count: int, dry_run: bool) -> None:
    print(f"Raw Card Recognition Agent")
    print(f"  Model:     {model}")
    print(f"  Input:     {input_dir}")
    print(f"  Output:    {OUTPUT_DIR / 'training-data' / 'raw_card'}")
    print(f"  Limit:     {count}")
    print()

    if not check_ollama(model):
        sys.exit(1)

    images = [p for p in input_dir.iterdir() if p.suffix.lower() in SUPPORTED_EXT]
    images = images[:count]

    if not images:
        print(f"No images found in {input_dir}")
        sys.exit(0)

    print(f"Found {len(images)} images to process\n")

    success = 0
    failed  = 0

    for i, img_path in enumerate(images, 1):
        print(f"[{i}/{len(images)}] {img_path.name}... ", end="", flush=True)

        try:
            b64      = image_to_base64(img_path)
            metadata = recognize_card(b64, model)

            if not metadata:
                print("✗ no JSON returned")
                failed += 1
                continue

            player = metadata.get("player") or "Unknown"
            year   = metadata.get("year")   or ""
            mfr    = metadata.get("manufacturer") or ""
            print(f"✓ {player} {year} {mfr}".strip())

            if not dry_run:
                save_example(img_path, metadata, img_path)
                success += 1
            else:
                print(f"     [DRY RUN] Would save: {json.dumps(metadata)}")

        except Exception as e:
            print(f"✗ error: {e}")
            failed += 1

        # Polite pause between requests
        if i < len(images):
            time.sleep(0.5)

    print(f"\n{'─' * 40}")
    print(f"✓ Processed:  {success}")
    print(f"✗ Failed:     {failed}")
    print(f"  Output dir: {OUTPUT_DIR / 'training-data' / 'raw_card'}")
    print(f"\nReview results in the AI Lab dashboard: http://localhost:3002/data")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recognize raw card images using Ollama vision")
    parser.add_argument("--input-dir", required=True, type=Path, help="Folder of card images to process")
    parser.add_argument("--model",     default="llama3.2-vision:11b", help="Ollama vision model to use")
    parser.add_argument("--count",     type=int, default=100, help="Max images to process")
    parser.add_argument("--dry-run",   action="store_true", help="Show results without saving")
    args = parser.parse_args()

    if not args.input_dir.exists():
        print(f"Error: {args.input_dir} does not exist")
        sys.exit(1)

    run(args.input_dir, args.model, args.count, args.dry_run)
