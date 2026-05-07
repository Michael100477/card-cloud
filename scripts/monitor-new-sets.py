"""
New Set Monitor — watches card news sites for new product releases.

Runs weekly (or on demand) and adds newly detected sets to the scrape queue.
Once a set is queued, the TCDB scraper can be run to download its images
as soon as TCDB collectors start uploading card photos (typically 2-6 weeks
after a set's release date).

Sources monitored:
  - Cardboard Connection (cardboardconnection.com) — set announcements
  - Beckett (beckett.com/news) — new product alerts
  - Sports Card Forum new product subforum

Usage:
  python scripts/monitor-new-sets.py            # check all sources
  python scripts/monitor-new-sets.py --list     # show currently queued sets
  python scripts/monitor-new-sets.py --add "2024 Topps Chrome Baseball" --year 2024

Requirements:
  pip install requests beautifulsoup4
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4")
    sys.exit(1)

REQUEST_DELAY = 3.0

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "CardCloudBot/1.0 (set release monitoring; contact: hello@thecardcloud.com)",
    "Accept":     "text/html,application/xhtml+xml",
})

# Queue file — persists between runs without needing the full DB
QUEUE_FILE = Path(__file__).parent.parent / "training-raw" / "set-queue.json"
QUEUE_FILE.parent.mkdir(parents=True, exist_ok=True)


# ─── Queue management ─────────────────────────────────────────────────────────

def load_queue() -> list[dict]:
    if QUEUE_FILE.exists():
        return json.loads(QUEUE_FILE.read_text())
    return []

def save_queue(queue: list[dict]) -> None:
    QUEUE_FILE.write_text(json.dumps(queue, indent=2, default=str))

def add_to_queue(set_name: str, year: int, manufacturer: str = "", source: str = "monitor") -> bool:
    queue = load_queue()
    # Avoid duplicates
    existing = {q["set_name"].lower() for q in queue}
    if set_name.lower() in existing:
        return False
    queue.append({
        "id":           f"set-{int(time.time())}",
        "set_name":     set_name,
        "year":         year,
        "manufacturer": manufacturer,
        "source":       source,
        "status":       "pending",
        "discovered_at": datetime.now().isoformat(),
        "tcdb_set_id":  None,
    })
    save_queue(queue)
    return True


# ─── Source scrapers ──────────────────────────────────────────────────────────

def check_cardboard_connection() -> list[dict]:
    """Check Cardboard Connection for new set announcements."""
    found = []
    year  = datetime.now().year

    urls = [
        f"https://www.cardboardconnection.com/baseball-card-products/{year}",
        f"https://www.cardboardconnection.com/football-card-products/{year}",
        f"https://www.cardboardconnection.com/basketball-card-products/{year}",
    ]

    sports = ["Baseball", "Football", "Basketball"]

    for url, sport in zip(urls, sports):
        try:
            print(f"  Checking Cardboard Connection ({sport})...")
            r = SESSION.get(url, timeout=15)
            soup = BeautifulSoup(r.text, "html.parser")

            for article in soup.select("article, .product-entry, h2 a, h3 a"):
                title = article.get_text(strip=True) if hasattr(article, "get_text") else ""
                if not title or len(title) < 10:
                    continue
                # Look for lines that mention a set/product
                if any(brand in title for brand in ["Topps","Panini","Upper Deck","Bowman","Prizm","Select","Donruss","Fleer"]):
                    # Extract year from title or use current
                    year_match = re.search(r"\b(20\d{2}|19\d{2})\b", title)
                    set_year = int(year_match.group(1)) if year_match else year
                    found.append({
                        "set_name": title[:80],
                        "year":     set_year,
                        "sport":    sport,
                        "source_url": url,
                    })

            time.sleep(REQUEST_DELAY)
        except Exception as e:
            print(f"  Error checking {url}: {e}")

    return found


def check_beckett_news() -> list[dict]:
    """Check Beckett for new product news."""
    found = []
    try:
        print("  Checking Beckett News...")
        r = SESSION.get("https://www.beckett.com/news/category/new-product/", timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")

        for article in soup.select("article h2, article h3, .post-title"):
            title = article.get_text(strip=True)
            if not title:
                continue
            year_match = re.search(r"\b(20\d{2})\b", title)
            if year_match and any(b in title for b in ["Topps","Panini","Upper Deck","Bowman"]):
                found.append({
                    "set_name": title[:80],
                    "year":     int(year_match.group(1)),
                    "source_url": "https://www.beckett.com/news/category/new-product/",
                })

        time.sleep(REQUEST_DELAY)
    except Exception as e:
        print(f"  Error checking Beckett: {e}")

    return found


# ─── Main ─────────────────────────────────────────────────────────────────────

def run_monitor() -> None:
    print("New Set Monitor — checking for recent releases")
    print(f"  Queue file: {QUEUE_FILE}\n")

    all_found = []
    all_found.extend(check_cardboard_connection())
    all_found.extend(check_beckett_news())

    print(f"\nFound {len(all_found)} potential sets")

    added = 0
    for s in all_found:
        if add_to_queue(s["set_name"], s["year"], source="monitor"):
            print(f"  + Added: {s['set_name']} ({s['year']})")
            added += 1

    queue = load_queue()
    pending = [q for q in queue if q["status"] == "pending"]
    print(f"\nQueue: {added} new, {len(pending)} pending scrape, {len(queue)} total")
    print(f"\nTo scrape a set: python scripts/tcdb-scraper.py --search \"<set name>\"")
    print(f"To see full queue: python scripts/monitor-new-sets.py --list")


def list_queue() -> None:
    queue = load_queue()
    if not queue:
        print("Queue is empty. Run without --list to check for new sets.")
        return

    print(f"{'Set Name':<50} {'Year':<6} {'Status':<12} {'TCDB ID'}")
    print("─" * 80)
    for q in sorted(queue, key=lambda x: x["discovered_at"], reverse=True):
        tcdb = q.get("tcdb_set_id") or "—"
        print(f"{q['set_name'][:49]:<50} {q['year']:<6} {q['status']:<12} {tcdb}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor for new card set releases")
    parser.add_argument("--list",         action="store_true", help="Show current queue")
    parser.add_argument("--add",          help="Manually add a set to the queue")
    parser.add_argument("--year",         type=int, default=datetime.now().year)
    parser.add_argument("--manufacturer", default="")
    args = parser.parse_args()

    if args.list:
        list_queue()
    elif args.add:
        if add_to_queue(args.add, args.year, args.manufacturer, source="manual"):
            print(f"✓ Added to queue: {args.add} ({args.year})")
        else:
            print(f"Already in queue: {args.add}")
    else:
        run_monitor()
