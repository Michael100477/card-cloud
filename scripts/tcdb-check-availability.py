"""
TCDB availability checker — runs after a set's release date and keeps
checking until enough card images are available to scrape.

Workflow:
  1. monitor-new-sets.py discovers a set + extracts release date
  2. This script runs daily (cron) after the release date
  3. It checks how many cards in the set have images on TCDB
  4. When coverage >= threshold (default 70%), it triggers the scraper
  5. Status flows: announced → waiting_release → checking_tcdb → ready_to_scrape

Usage:
  python scripts/tcdb-check-availability.py          # check all sets in queue
  python scripts/tcdb-check-availability.py --force 12345  # force-check a set ID

Schedule with Windows Task Scheduler or add to PM2 as a daily job.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, date
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4")
    sys.exit(1)

BASE_URL      = "https://www.tcdb.com"
QUEUE_FILE    = Path(__file__).parent.parent / "training-raw" / "set-queue.json"
REQUEST_DELAY = 2.0

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "CardCloudBot/1.0 (availability check; contact: hello@thecardcloud.com)",
})


def load_queue() -> list[dict]:
    if QUEUE_FILE.exists():
        return json.loads(QUEUE_FILE.read_text())
    return []

def save_queue(queue: list[dict]) -> None:
    QUEUE_FILE.write_text(json.dumps(queue, indent=2, default=str))


def find_tcdb_set(set_name: str, year: int) -> str | None:
    """Search TCDB for a set and return its set ID."""
    params = f"search={requests.utils.quote(set_name)}&year={year}"
    url    = f"{BASE_URL}/search.cfm?{params}"
    try:
        r    = SESSION.get(url, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")
        for link in soup.select("a[href*='sid=']"):
            m = re.search(r"sid=(\d+)", link["href"])
            if m:
                return m.group(1)
    except Exception as e:
        print(f"  TCDB search error: {e}")
    return None


def count_images_in_set(tcdb_set_id: str) -> tuple[int, int]:
    """Returns (cards_with_images, total_cards)."""
    url = f"{BASE_URL}/ViewSet.cfm?sid={tcdb_set_id}"
    try:
        r    = SESSION.get(url, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")

        total  = 0
        with_images = 0

        for row in soup.select("table tr"):
            cells = row.find_all("td")
            if len(cells) < 2:
                continue
            link = cells[0].find("a") or cells[1].find("a")
            if not link or "cid=" not in link.get("href", ""):
                continue
            total += 1
            # Check if the row has an image indicator (TCDB shows a camera icon)
            if row.find("img") or "📷" in row.get_text():
                with_images += 1

        return with_images, total
    except Exception as e:
        print(f"  Image count error: {e}")
        return 0, 0


def check_all_sets(force_id: str | None = None) -> None:
    queue = load_queue()
    today = date.today()
    updated = False

    for s in queue:
        if force_id and s["id"] != force_id:
            continue

        status = s.get("status", "announced")

        # Skip completed/failed sets
        if status in ("done", "failed", "scraping"):
            continue

        # Check if release date has passed
        release_date_str = s.get("release_date")
        if release_date_str:
            try:
                release_date = date.fromisoformat(release_date_str[:10])
                if today < release_date and not force_id:
                    days_left = (release_date - today).days
                    print(f"  [{s['set_name']}] Releases in {days_left} day(s) — skipping")
                    continue
            except ValueError:
                pass

        print(f"\nChecking: {s['set_name']} ({s['year']})")
        s["check_count"] = s.get("check_count", 0) + 1
        s["last_checked"] = datetime.now().isoformat()

        # Find TCDB set ID if we don't have it
        if not s.get("tcdb_set_id"):
            print(f"  Searching TCDB...")
            time.sleep(REQUEST_DELAY)
            tcdb_id = find_tcdb_set(s["set_name"], s["year"])
            if tcdb_id:
                print(f"  Found TCDB set ID: {tcdb_id}")
                s["tcdb_set_id"] = tcdb_id
                s["status"] = "checking_tcdb"
            else:
                print(f"  Not found on TCDB yet (check #{s['check_count']})")
                updated = True
                continue

        # Count available images
        time.sleep(REQUEST_DELAY)
        with_images, total = count_images_in_set(s["tcdb_set_id"])
        s["tcdb_images_found"] = with_images
        s["card_count"] = total if total > 0 else s.get("card_count")

        threshold = s.get("image_threshold", 70)
        coverage  = (with_images / total * 100) if total > 0 else 0

        print(f"  Images: {with_images}/{total} ({coverage:.0f}%) — need {threshold}%")

        if total > 0 and coverage >= threshold:
            print(f"  ✓ Ready to scrape! Run:")
            print(f"    python scripts/tcdb-scraper.py --set-id {s['tcdb_set_id']} --set-name \"{s['set_name']}\"")
            s["status"] = "ready_to_scrape"
        elif s["check_count"] > 30:
            print(f"  ✗ Checked 30 times, marking as failed")
            s["status"] = "failed"
            s["notes"]  = "Insufficient images after 30 checks"
        else:
            print(f"  Waiting for more images (check #{s['check_count']})")
            s["status"] = "checking_tcdb"

        updated = True

    if updated:
        save_queue(queue)

    # Summary
    ready  = [s for s in queue if s.get("status") == "ready_to_scrape"]
    active = [s for s in queue if s.get("status") in ("checking_tcdb", "announced", "waiting_release")]
    print(f"\nQueue: {len(ready)} ready to scrape, {len(active)} still checking")
    for s in ready:
        print(f"  READY: {s['set_name']} (sid={s.get('tcdb_set_id')}) — {s.get('tcdb_images_found',0)} images")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check TCDB image availability for queued sets")
    parser.add_argument("--force", help="Force-check a specific queue item ID")
    args = parser.parse_args()

    print(f"TCDB Availability Checker — {date.today()}")
    check_all_sets(force_id=args.force)
