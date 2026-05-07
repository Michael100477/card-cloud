"""
TCDB (Trading Card Database) scraper for training data collection.

Downloads card images and metadata from tcdb.com for a given set.
Images are saved locally for human review before being used as training data.

Usage:
  python scripts/tcdb-scraper.py --set-id 12345 --set-name "2024 Topps Chrome Baseball"
  python scripts/tcdb-scraper.py --search "2024 Topps Chrome" --year 2024
  python scripts/tcdb-scraper.py --dry-run --search "2024 Bowman"

Output saved to: ~/training-data/training-data/tcdb/{set-id}/
  {card-id}-front.jpg
  {card-id}-back.jpg
  {card-id}.json

Rate limiting: 2s between requests — be a good citizen.

Note: Scraping is for personal model training only.
For commercial use, consider reaching out to TCDB for a data partnership.

Requirements:
  pip install requests beautifulsoup4 pillow
"""

import argparse
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urljoin, urlencode, quote

try:
    import requests
    from bs4 import BeautifulSoup
    from PIL import Image
    from io import BytesIO
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4 pillow")
    sys.exit(1)

BASE_URL      = "https://www.tcdb.com"
OUTPUT_BASE   = Path(os.environ.get("TRAINING_DATA_PATH", str(Path.home() / "training-data")))
REQUEST_DELAY = 2.0  # seconds between requests — polite rate limit

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "CardCloudBot/1.0 (training data collection; contact: hello@thecardcloud.com)",
    "Accept":     "text/html,application/xhtml+xml",
})


# ─── Set search ───────────────────────────────────────────────────────────────

def search_sets(query: str, year: int | None = None) -> list[dict]:
    """Search TCDB for sets matching the query."""
    params = {"search": query}
    if year:
        params["year"] = str(year)

    url = f"{BASE_URL}/search.cfm?" + urlencode(params)
    print(f"Searching TCDB: {query}")

    try:
        r = SESSION.get(url, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")

        results = []
        # TCDB search results are in a table
        for row in soup.select("table.main-table tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            link = cells[0].find("a")
            if not link:
                continue
            href = link.get("href", "")
            sid_match = re.search(r"sid=(\d+)", href)
            if not sid_match:
                continue

            results.append({
                "set_id":   sid_match.group(1),
                "set_name": link.get_text(strip=True),
                "year":     cells[1].get_text(strip=True) if len(cells) > 1 else "",
                "cards":    cells[2].get_text(strip=True) if len(cells) > 2 else "",
            })
        return results
    except Exception as e:
        print(f"  Search error: {e}")
        return []


# ─── Set scraping ─────────────────────────────────────────────────────────────

def get_set_checklist(set_id: str) -> list[dict]:
    """Get all cards in a set from TCDB."""
    url = f"{BASE_URL}/ViewSet.cfm?sid={set_id}"
    print(f"Loading checklist from {url}")

    try:
        r = SESSION.get(url, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")

        # Extract set metadata
        set_name = soup.find("h1")
        set_name = set_name.get_text(strip=True) if set_name else "Unknown Set"

        cards = []
        for row in soup.select("table tr"):
            cells = row.find_all("td")
            if len(cells) < 3:
                continue
            link = cells[0].find("a") or cells[1].find("a")
            if not link:
                continue
            href = link.get("href", "")
            cid_match = re.search(r"cid=(\d+)", href)
            if not cid_match:
                continue

            cards.append({
                "card_id":     cid_match.group(1),
                "set_id":      set_id,
                "card_number": cells[0].get_text(strip=True),
                "player":      cells[1].get_text(strip=True) if len(cells) > 1 else "",
                "set_name":    set_name,
            })

        return cards
    except Exception as e:
        print(f"  Checklist error: {e}")
        return []


def get_card_images(set_id: str, card_id: str) -> dict:
    """Get front and back image URLs for a specific card."""
    url = f"{BASE_URL}/ViewCard.cfm?sid={set_id}&cid={card_id}"
    try:
        r = SESSION.get(url, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")

        images = {}
        # TCDB shows card images with class or alt text
        for img in soup.find_all("img"):
            src = img.get("src", "")
            alt = img.get("alt", "").lower()
            if not src or "card" not in alt and "front" not in alt and "back" not in alt:
                continue
            if "front" in alt or (not images.get("front") and src.endswith((".jpg", ".png", ".webp"))):
                images["front"] = urljoin(BASE_URL, src)
            elif "back" in alt:
                images["back"] = urljoin(BASE_URL, src)

        # Fallback: find first two card-sized images
        if not images:
            card_imgs = [
                urljoin(BASE_URL, img["src"])
                for img in soup.find_all("img")
                if img.get("src", "").endswith((".jpg", ".png")) and "/images/" in img.get("src", "")
            ]
            if card_imgs:
                images["front"] = card_imgs[0]
            if len(card_imgs) > 1:
                images["back"] = card_imgs[1]

        return images
    except Exception as e:
        print(f"  Card image error ({card_id}): {e}")
        return {}


def download_image(url: str) -> bytes | None:
    """Download an image and return bytes."""
    try:
        r = SESSION.get(url, timeout=20)
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", ""):
            img = Image.open(BytesIO(r.content)).convert("RGB")
            if max(img.size) > 1568:
                img.thumbnail((1568, 1568), Image.LANCZOS)
            buf = BytesIO()
            img.save(buf, "JPEG", quality=90)
            return buf.getvalue()
    except Exception:
        pass
    return None


def save_card(card: dict, front_bytes: bytes | None, back_bytes: bytes | None, set_id: str) -> None:
    """Save card images and metadata to disk."""
    out_dir = OUTPUT_BASE / "training-data" / "tcdb" / set_id
    out_dir.mkdir(parents=True, exist_ok=True)

    cid = card["card_id"]

    if front_bytes:
        (out_dir / f"{cid}-front.jpg").write_bytes(front_bytes)
    if back_bytes:
        (out_dir / f"{cid}-back.jpg").write_bytes(back_bytes)

    metadata = {
        **card,
        "source":     "tcdb",
        "front_path": str(out_dir / f"{cid}-front.jpg") if front_bytes else None,
        "back_path":  str(out_dir / f"{cid}-back.jpg")  if back_bytes  else None,
    }
    (out_dir / f"{cid}.json").write_text(json.dumps(metadata, indent=2))


# ─── Main ─────────────────────────────────────────────────────────────────────

def scrape_set(set_id: str, set_name: str, dry_run: bool = False, limit: int = 0) -> None:
    print(f"\nScraping: {set_name} (TCDB set {set_id})")
    print(f"  Output: {OUTPUT_BASE / 'training-data' / 'tcdb' / set_id}")

    cards = get_set_checklist(set_id)
    if not cards:
        print("  No cards found — check the set ID")
        return

    if limit:
        cards = cards[:limit]
    print(f"  {len(cards)} cards to process")

    success = failed = 0

    for i, card in enumerate(cards, 1):
        print(f"  [{i}/{len(cards)}] #{card['card_number']} {card['player']}... ", end="", flush=True)

        if dry_run:
            print("[dry run]")
            continue

        time.sleep(REQUEST_DELAY)

        images = get_card_images(set_id, card["card_id"])
        front = download_image(images["front"])  if images.get("front") else None
        if images.get("back"):
            time.sleep(REQUEST_DELAY)
            back = download_image(images["back"])
        else:
            back = None

        if front or back:
            save_card(card, front, back, set_id)
            print(f"✓ {'front+back' if (front and back) else 'front only' if front else 'back only'}")
            success += 1
        else:
            print("✗ no images")
            failed += 1

    print(f"\n  Done: {success} saved, {failed} failed")
    print(f"  Review at: http://localhost:3002/data")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape card images from TCDB")
    parser.add_argument("--set-id",   help="TCDB set ID (from URL: sid=XXXXX)")
    parser.add_argument("--set-name", help="Set name (for metadata)")
    parser.add_argument("--search",   help="Search TCDB for a set by name")
    parser.add_argument("--year",     type=int, help="Filter search by year")
    parser.add_argument("--limit",    type=int, default=0, help="Max cards to scrape (0=all)")
    parser.add_argument("--dry-run",  action="store_true", help="Show what would be scraped")
    args = parser.parse_args()

    if args.search:
        results = search_sets(args.search, args.year)
        if not results:
            print("No sets found")
            sys.exit(0)
        print(f"\nFound {len(results)} set(s):")
        for r in results[:10]:
            print(f"  [{r['set_id']}] {r['set_name']} ({r['year']}) — {r['cards']} cards")
        if not args.dry_run and results:
            choice = input("\nEnter set ID to scrape (or Enter to skip): ").strip()
            if choice:
                name = next((r["set_name"] for r in results if r["set_id"] == choice), args.search)
                scrape_set(choice, name, dry_run=False, limit=args.limit)
    elif args.set_id:
        scrape_set(args.set_id, args.set_name or f"Set {args.set_id}", dry_run=args.dry_run, limit=args.limit)
    else:
        parser.print_help()
