#!/usr/bin/env python3
"""
Scrape Common Core State Standards from thecorestandards.org

Outputs:
  data/common_core_standards.json
  data/common_core_standards.csv

Usage:
  python3 scripts/scrape_common_core_standards.py

Requirements:
  pip install requests beautifulsoup4 pandas
"""

import json
import re
import sys
import time
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://www.thecorestandards.org"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ElevateEducationBot/1.0; "
        "+https://github.com/elevate-education; educational-standards-import)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
REQUEST_DELAY = 1.5  # seconds between requests — be polite

# Subjects and their top-level URLs
SUBJECT_URLS = {
    "Math": f"{BASE_URL}/Math/",
    "ELA-Literacy": f"{BASE_URL}/ELA-Literacy/",
}

# Output paths (relative to project root)
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
JSON_OUT = DATA_DIR / "common_core_standards.json"
CSV_OUT = DATA_DIR / "common_core_standards.csv"

# Regex patterns for standard codes
CODE_PATTERN = re.compile(
    r"CCSS\.(Math\.Content|Math\.Practice|ELA-Literacy)\.[A-Za-z0-9.\-]+",
    re.IGNORECASE,
)

# Grade normalisation — map URL path segments to human-readable grade names
GRADE_MAP = {
    "K": "Kindergarten",
    "1": "Grade 1",
    "2": "Grade 2",
    "3": "Grade 3",
    "4": "Grade 4",
    "5": "Grade 5",
    "6": "Grade 6",
    "7": "Grade 7",
    "8": "Grade 8",
    "9-10": "Grades 9–10",
    "11-12": "Grades 11–12",
    "HSN": "High School: Number & Quantity",
    "HSA": "High School: Algebra",
    "HSF": "High School: Functions",
    "HSG": "High School: Geometry",
    "HSS": "High School: Statistics & Probability",
    "Practice": "Standards for Mathematical Practice",
}

# Grade-band → multiple grades for ELA (Grades 9-10 covers 9 and 10, etc.)
GRADE_BAND_EXPAND = {
    "Grades 9–10": ["Grade 9", "Grade 10"],
    "Grades 11–12": ["Grade 11", "Grade 12"],
}


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

standards: list[dict] = []
seen_codes: set[str] = set()
skipped_urls: list[str] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch(url: str) -> BeautifulSoup | None:
    """GET a URL politely. Returns parsed BeautifulSoup or None on failure."""
    time.sleep(REQUEST_DELAY)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.exceptions.HTTPError as e:
        print(f"  [SKIP] HTTP {e.response.status_code}: {url}", file=sys.stderr)
    except requests.exceptions.ConnectionError:
        print(f"  [SKIP] Connection error: {url}", file=sys.stderr)
    except requests.exceptions.Timeout:
        print(f"  [SKIP] Timeout: {url}", file=sys.stderr)
    except Exception as e:
        print(f"  [SKIP] {type(e).__name__}: {url} — {e}", file=sys.stderr)
    skipped_urls.append(url)
    return None


def normalise_text(text: str) -> str:
    """Collapse whitespace and strip."""
    return re.sub(r"\s+", " ", text).strip()


def grade_from_path(path: str) -> str:
    """Extract a human-readable grade label from a URL path segment."""
    # path examples: /Math/Content/K/ or /ELA-Literacy/RL/K/
    parts = [p for p in path.strip("/").split("/") if p]
    for part in reversed(parts):
        if part in GRADE_MAP:
            return GRADE_MAP[part]
        # Numeric grade check
        if re.match(r"^\d$", part):
            return f"Grade {part}"
    return parts[-1] if parts else "Unknown"


def add_standard(
    subject: str,
    grade: str,
    domain: str,
    cluster: str,
    code: str,
    text: str,
    url: str,
):
    """Add a standard to the global list if not already seen."""
    code = normalise_text(code)
    text = normalise_text(text)
    if not code or not text:
        return
    key = f"{code}::{text[:80]}"
    if key in seen_codes:
        return
    seen_codes.add(key)
    standards.append(
        {
            "subject": subject,
            "grade": grade,
            "domain": normalise_text(domain),
            "cluster": normalise_text(cluster),
            "code": code,
            "text": text,
            "url": url,
        }
    )


# ---------------------------------------------------------------------------
# Grade page parser — shared by Math and ELA
# ---------------------------------------------------------------------------

def parse_grade_page(soup: BeautifulSoup, subject: str, grade: str, url: str):
    """
    Parse a single grade/strand page and extract all standards.
    Tries multiple selector strategies and falls back to regex code extraction.
    """
    content = (
        soup.find("div", class_=re.compile(r"page[-_]content|entry[-_]content|content[-_]area", re.I))
        or soup.find("article")
        or soup.find("main")
        or soup.body
    )
    if not content:
        print(f"  [WARN] No content container found: {url}", file=sys.stderr)
        return

    current_domain = ""
    current_cluster = ""

    # Walk through all block-level elements in order
    block_tags = content.find_all(
        ["h1", "h2", "h3", "h4", "h5", "p", "li", "div"],
        recursive=False,
    )

    # If top-level gives nothing useful, go one level deeper
    if len(block_tags) < 3:
        block_tags = content.find_all(["h1", "h2", "h3", "h4", "h5", "p", "li"])

    # Walk elements, tracking domain/cluster context
    for el in block_tags:
        tag = el.name
        text = normalise_text(el.get_text(" ", strip=True))
        if not text:
            continue

        # Detect domain headings (typically h2, h3 — no code, longer heading)
        if tag in ("h2", "h3") and not CODE_PATTERN.search(text):
            # Heuristic: domain names are usually Title Case, ≥ 4 words, or known keywords
            if len(text) > 10:
                current_domain = text
                current_cluster = ""
            continue

        # Detect cluster headings (h4, h5, or strong-only <p>)
        if tag in ("h4", "h5"):
            current_cluster = text
            continue
        if tag == "p" and el.find("strong") and not CODE_PATTERN.search(text):
            inner = normalise_text(el.find("strong").get_text())
            if len(inner) > 5 and not CODE_PATTERN.search(inner):
                current_cluster = inner
                continue

        # Look for standard codes anywhere in this element
        code_matches = CODE_PATTERN.findall(text)
        if code_matches:
            # Extract the first code and use the rest of the text as the standard text
            full_code_match = CODE_PATTERN.search(text)
            if full_code_match:
                code = full_code_match.group(0)
                std_text = text[full_code_match.end():].lstrip(" .:—–-").strip()
                if not std_text:
                    std_text = text  # fallback: use whole text
                add_standard(subject, grade, current_domain, current_cluster, code, std_text, url)
            continue

    # Secondary pass: scan ALL text nodes for codes (catches deeply nested structures)
    all_text = normalise_text(content.get_text(" "))
    for line in re.split(r"(?<=[.!?])\s+|[\n\r]+", all_text):
        line = normalise_text(line)
        m = CODE_PATTERN.search(line)
        if m:
            code = m.group(0)
            std_text = line[m.end():].lstrip(" .:—–-").strip()
            if std_text and len(std_text) > 5:
                add_standard(subject, grade, current_domain, current_cluster, code, std_text, url)


# ---------------------------------------------------------------------------
# Discover grade/strand page links from a subject's top-level page
# ---------------------------------------------------------------------------

def discover_grade_links(soup: BeautifulSoup, subject: str) -> list[tuple[str, str]]:
    """
    Return a list of (url, grade_label) pairs for all grade/strand pages
    linked from the subject's top-level page.
    """
    results = []
    seen_hrefs = set()

    # Look for internal links matching subject path pattern
    subject_path = f"/{subject}/"
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        # Normalise to absolute URL
        if href.startswith("/"):
            href = BASE_URL + href
        if not href.startswith(BASE_URL):
            continue
        # Only follow links under this subject's path
        path = href.replace(BASE_URL, "")
        if not path.startswith(subject_path):
            continue
        # Skip the top-level subject page itself
        if path.rstrip("/") == subject_path.rstrip("/"):
            continue
        # Skip anchor links, PDFs, and asset files
        if "#" in href or href.endswith(".pdf") or "/assets/" in href:
            continue
        if href in seen_hrefs:
            continue
        seen_hrefs.add(href)

        # Derive grade label from URL path
        grade = grade_from_path(path)
        results.append((href, grade))

    return results


# ---------------------------------------------------------------------------
# Subject scrapers
# ---------------------------------------------------------------------------

def scrape_subject(subject: str, top_url: str):
    print(f"\n=== Scraping {subject} ===")
    soup = fetch(top_url)
    if not soup:
        return

    grade_links = discover_grade_links(soup, subject)
    if not grade_links:
        print(f"  [WARN] No grade links found on {top_url} — trying to parse directly", file=sys.stderr)
        parse_grade_page(soup, subject, "General", top_url)
        return

    print(f"  Found {len(grade_links)} grade/strand pages")
    for url, grade in grade_links:
        print(f"  Fetching: {grade} ({url})")
        grade_soup = fetch(url)
        if not grade_soup:
            continue
        before = len(standards)
        parse_grade_page(grade_soup, subject, grade, url)
        added = len(standards) - before
        print(f"    → {added} standards extracted")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    for subject, url in SUBJECT_URLS.items():
        scrape_subject(subject, url)

    total = len(standards)
    print(f"\n✓ Total standards collected: {total}")

    if skipped_urls:
        print(f"⚠ Skipped {len(skipped_urls)} URL(s):")
        for u in skipped_urls:
            print(f"  {u}")

    if total == 0:
        print(
            "\n[ERROR] No standards were extracted.\n"
            "The site structure may have changed. "
            "Check skipped URLs and inspect the page HTML manually.\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # Remove duplicates (shouldn't be any, but safety check)
    unique = {s["code"] + "::" + s["text"][:60]: s for s in standards}
    deduped = list(unique.values())
    if len(deduped) < total:
        print(f"  (Removed {total - len(deduped)} duplicate entries)")

    # Write JSON
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "source": "https://www.thecorestandards.org/",
                    "subjects": list(SUBJECT_URLS.keys()),
                    "total": len(deduped),
                    "note": (
                        "Common Core State Standards. "
                        "© Copyright 2010 National Governors Association Center for "
                        "Best Practices and Council of Chief State School Officers. "
                        "All rights reserved."
                    ),
                },
                "standards": deduped,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"✓ JSON → {JSON_OUT}")

    # Write CSV
    df = pd.DataFrame(deduped)
    df.to_csv(CSV_OUT, index=False, encoding="utf-8")
    print(f"✓ CSV  → {CSV_OUT}")

    # Copy to public/data so Vite serves it at /data/common_core_standards.json
    public_dest = PROJECT_ROOT / "public" / "data" / "common_core_standards.json"
    public_dest.parent.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(JSON_OUT, public_dest)
    print(f"✓ Copied to public/data/ for Vite serving")


if __name__ == "__main__":
    main()
