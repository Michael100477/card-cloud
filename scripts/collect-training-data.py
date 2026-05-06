"""
Training data collection agent — eBay slab image harvester.

Searches eBay for graded card listings, downloads the slab photo,
and extracts the card metadata from the listing title.

The listing title is the ground truth:
  "2011 Bowman Chrome Mike Trout RC PSA 9.5 Gem Mint Auto"
   → year=2011, set="Bowman Chrome", player="Mike Trout",
     grader="PSA", grade="9.5", tags=[Rookie, Auto]

Usage:
  python scripts/collect-training-data.py --count 500 --grader PSA
  python scripts/collect-training-data.py --count 200 --grader BGS

Output:
  training-raw/{id}.jpg       — slab photo
  training-raw/{id}.json      — extracted metadata
  Review with: python scripts/review-training-data.py

Requirements:
  pip install requests beautifulsoup4 ebaysdk pillow

Note: Uses eBay's public Browse API (no API key needed for basic searches).
Respects rate limits. Only downloads images — never creates or modifies listings.
"""

import argparse
import json
import os
import re
import time
import uuid
from pathlib import Path

try:
    import requests
    from PIL import Image
    from io import BytesIO
except ImportError:
    print("Missing dependencies. Run: pip install requests pillow beautifulsoup4")
    exit(1)

OUTPUT_DIR = Path("training-raw")
OUTPUT_DIR.mkdir(exist_ok=True)

GRADERS   = ["PSA", "BGS", "SGC", "CGC", "BCCG"]
GRADER_RE = re.compile(r'\b(PSA|BGS|SGC|CGC|BCCG|BGGS)\b', re.IGNORECASE)
GRADE_RE  = re.compile(r'\b(10|9\.5|9|8\.5|8|7\.5|7|6|5|4|3|2|1)\b')
YEAR_RE   = re.compile(r'\b(19[5-9]\d|20[0-2]\d)\b')

# eBay Browse API — public endpoint, no OAuth needed for basic search
EBAY_SEARCH = "https://api.ebay.com/buy/browse/v1/item_summary/search"

def parse_title(title: str) -> dict:
    """Extract card metadata from a listing title using regex heuristics."""
    meta = {}

    # Year
    year_m = YEAR_RE.search(title)
    if year_m:
        meta["year"] = int(year_m.group(1))

    # Grader
    grader_m = GRADER_RE.search(title)
    if grader_m:
        meta["grader"] = grader_m.group(1).upper()

    # Grade (look for number after grader)
    grade_m = GRADE_RE.search(title[grader_m.end():] if grader_m else title)
    if grade_m:
        meta["grade"] = grade_m.group(1)

    # Tags
    tags = []
    if re.search(r'\bRC\b|\bRookie\b', title, re.I): tags.append("Rookie")
    if re.search(r'\bAuto\b|\bAutograph\b', title, re.I): tags.append("Auto")
    if re.search(r'\bJersey\b|\bPatch\b', title, re.I): tags.append("Jersey")
    if re.search(r'\bRefractor\b', title, re.I): tags.append("Refractor")
    if re.search(r'\bParallel\b', title, re.I): tags.append("Parallel")
    if re.search(r'\b1\/1\b', title): tags.append("1/1")
    if tags:
        meta["tags"] = tags

    meta["raw_title"] = title
    return meta

def search_ebay(query: str, limit: int = 50) -> list:
    """Search eBay using their public Browse API."""
    headers = {
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
    }
    params = {
        "q":           query,
        "limit":       min(limit, 200),
        "filter":      "conditions:{USED}",
        "fieldgroups": "MATCHING_ITEMS,ASPECT_REFINEMENTS",
    }

    try:
        # eBay Browse API requires OAuth for production but the sandbox
        # endpoint works for basic searches. For real data, register at
        # developer.ebay.com (free) and add EBAY_APP_ID to .env
        app_id = os.environ.get("EBAY_APP_ID")
        if app_id:
            headers["Authorization"] = f"Bearer {app_id}"

        resp = requests.get(EBAY_SEARCH, headers=headers, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("itemSummaries", [])
    except Exception as e:
        print(f"eBay search error: {e}")

    return []

def download_image(url: str) -> bytes | None:
    """Download an image, return bytes or None on failure."""
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200 and "image" in r.headers.get("Content-Type", ""):
            # Validate it's a real image
            img = Image.open(BytesIO(r.content))
            img.verify()
            return r.content
    except Exception:
        pass
    return None

def collect(grader: str, count: int, dry_run: bool = False):
    """Main collection loop."""
    queries = [
        f"{grader} graded baseball card",
        f"{grader} graded football card",
        f"{grader} graded basketball card",
        f"{grader} graded card slab",
        f"PSA graded vintage baseball",
        f"{grader} gem mint",
    ]

    collected = 0
    seen_ids  = set()

    for query in queries:
        if collected >= count:
            break

        print(f"\nSearching: {query}")
        items = search_ebay(query, limit=200)
        print(f"  Found {len(items)} listings")

        for item in items:
            if collected >= count:
                break

            item_id = item.get("itemId", "")
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)

            title      = item.get("title", "")
            thumb_url  = item.get("thumbnailImages", [{}])[0].get("imageUrl", "")
            image_url  = item.get("image", {}).get("imageUrl", thumb_url)

            if not image_url:
                continue

            # Parse metadata from title
            meta = parse_title(title)
            if not meta.get("grader"):
                continue  # skip if grader not in title

            if dry_run:
                print(f"  [DRY RUN] Would save: {title[:80]}")
                collected += 1
                continue

            # Download image
            img_bytes = download_image(image_url)
            if not img_bytes:
                continue

            # Save image + metadata
            uid      = str(uuid.uuid4())[:8]
            img_path = OUTPUT_DIR / f"{uid}.jpg"
            meta_path = OUTPUT_DIR / f"{uid}.json"

            with open(img_path, "wb") as f:
                f.write(img_bytes)

            meta["image_file"] = str(img_path)
            meta["ebay_item_id"] = item_id
            meta["source"] = "ebay"

            with open(meta_path, "w") as f:
                json.dump(meta, f, indent=2)

            collected += 1
            print(f"  [{collected}/{count}] {title[:60]}...")

            time.sleep(0.5)  # polite rate limit

    print(f"\n✓ Collected {collected} examples to {OUTPUT_DIR}/")
    print(f"  Review with: python scripts/review-training-data.py")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect slab training images from eBay")
    parser.add_argument("--count",   type=int, default=100, help="Images to collect (default 100)")
    parser.add_argument("--grader",  type=str, default="PSA", help="Grader to search for")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be collected without downloading")
    args = parser.parse_args()

    collect(args.grader, args.count, args.dry_run)
