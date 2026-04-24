#!/usr/bin/env python3
"""
Scrape the Common Core State Standards from thecorestandards.org.

Usage:
    python3 scripts/scrape_common_core_standards.py          # live scrape (auto-falls-back)
    python3 scripts/scrape_common_core_standards.py --offline # force offline bundled fallback
    python3 scripts/scrape_common_core_standards.py --force-live # fail if live scrape is short

Behaviour:
    1. Crawls ELA and Math nested pages via requests + BeautifulSoup.
       Seeds from known deep URLs because /Math/ root sometimes returns a cached
       SPA shell with no content.
    2. If the live site is unreachable (403, timeout, connection error), OR
       --offline is passed, OR fewer than 100 standards are collected, falls
       back to the bundled @weo-edu/standards npm tarball at
       scripts/vendor/weo-edu-standards-0.1.6.tgz (the complete 1,580-standard
       authoritative dataset from https://npmjs.com/package/@weo-edu/standards).

Outputs:
    data/common_core_standards.json
    data/common_core_standards.csv
    public/data/common_core_standards.json  (copied so Vite can serve it)

Requirements:
    pip install requests beautifulsoup4 pandas
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import tarfile
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Install dependencies:  pip install requests beautifulsoup4 pandas", file=sys.stderr)
    raise

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = "https://www.thecorestandards.org"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Seed URLs — do NOT start at /Math/ (returns incomplete shell).
# Seed at each grade's root page + ELA-Literacy root + a known-working deep page.
SEED_URLS = [
    f"{BASE_URL}/ELA-Literacy/",
    f"{BASE_URL}/Math/Content/3/OA/",   # known-working deep page per user spec
    f"{BASE_URL}/Math/Content/K/",
    f"{BASE_URL}/Math/Content/1/",
    f"{BASE_URL}/Math/Content/2/",
    f"{BASE_URL}/Math/Content/3/",
    f"{BASE_URL}/Math/Content/4/",
    f"{BASE_URL}/Math/Content/5/",
    f"{BASE_URL}/Math/Content/6/",
    f"{BASE_URL}/Math/Content/7/",
    f"{BASE_URL}/Math/Content/8/",
    f"{BASE_URL}/Math/Content/HSN/",
    f"{BASE_URL}/Math/Content/HSA/",
    f"{BASE_URL}/Math/Content/HSF/",
    f"{BASE_URL}/Math/Content/HSG/",
    f"{BASE_URL}/Math/Content/HSS/",
    f"{BASE_URL}/Math/Practice/",
]

ALLOWED_PATH_PREFIXES = ("/ELA-Literacy/", "/Math/Content/", "/Math/Practice/")

REQUEST_DELAY = 1.2
MAX_PAGES = 2000
MIN_LIVE_STANDARDS = 100  # below this threshold we treat the live scrape as a failure

CCSS_CODE = re.compile(
    r"CCSS\.(?:Math\.Content|Math\.Practice|ELA-Literacy)\.[A-Za-z0-9.\-]+"
)

HS_PREFIX_MAP = {"N": "HSN", "A": "HSA", "F": "HSF", "G": "HSG", "S": "HSS"}

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"
VENDOR_DIR = PROJECT_ROOT / "scripts" / "vendor"
JSON_OUT = DATA_DIR / "common_core_standards.json"
CSV_OUT = DATA_DIR / "common_core_standards.csv"
PUBLIC_JSON_OUT = PUBLIC_DATA_DIR / "common_core_standards.json"

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _short_from_full(code: str) -> str:
    """CCSS.Math.Content.K.CC.A.1 → K.CC.1 ; CCSS.ELA-Literacy.L.K.6 → L.K.6"""
    stripped = re.sub(r"^CCSS\.(?:Math\.Content|Math\.Practice|ELA-Literacy)\.", "", code)
    parts = stripped.split(".")
    # Drop the single-letter cluster (Math only): K.CC.A.1 → K.CC.1
    if len(parts) >= 4 and len(parts[-2]) == 1 and parts[-2].isalpha():
        parts = parts[:-2] + parts[-1:]
    return ".".join(parts)


def _parent_of(short_code: str) -> str | None:
    """Return parent short code for sub-standards (K.CC.A.4.a → K.CC.A.4)."""
    if re.search(r"\.[a-z]$", short_code):
        return short_code.rsplit(".", 1)[0]
    return None


def _grade_from_url(path: str) -> str:
    """Derive a normalised grade label from a CCSS URL path."""
    parts = [p for p in path.strip("/").split("/") if p]
    for p in parts:
        if p == "K":
            return "K"
        if p in ("HSN", "HSA", "HSF", "HSG", "HSS"):
            return "HS"
        if re.match(r"^\d$", p):
            return p
    return "K-12"


def _subject_from_url(path: str) -> str:
    if path.startswith("/ELA-Literacy"):
        return "ELA-Literacy"
    if path.startswith("/Math/"):
        return "Math"
    return "Unknown"


# ---------------------------------------------------------------------------
# Live crawler
# ---------------------------------------------------------------------------


def _should_follow(href: str, visited: set, queue_set: set) -> bool:
    if not href:
        return False
    parsed = urlparse(href)
    if parsed.netloc and parsed.netloc != "www.thecorestandards.org":
        return False
    path = parsed.path or ""
    if not any(path.startswith(p) for p in ALLOWED_PATH_PREFIXES):
        return False
    if href in visited or href in queue_set:
        return False
    if path.endswith((".pdf", ".doc", ".docx", ".zip", ".ppt", ".xml")):
        return False
    return True


def _parse_html_page(html: str, url: str, standards: dict):
    """Parse a CCSS page and fill `standards` dict, keyed by full CCSS code."""
    soup = BeautifulSoup(html, "html.parser")
    path = urlparse(url).path
    subject = _subject_from_url(path)
    grade = _grade_from_url(path)
    content = soup.find("article") or soup.find("main") or soup.body
    if not content:
        return

    domain = ""
    cluster = ""
    for el in content.find_all(["h1", "h2", "h3", "h4", "h5", "p", "li", "div"]):
        text = _normalise(el.get_text(" ", strip=True))
        if not text:
            continue
        if el.name in ("h1", "h2"):
            if not CCSS_CODE.search(text) and len(text) > 3:
                domain = text
                cluster = ""
            continue
        if el.name in ("h3", "h4", "h5"):
            if not CCSS_CODE.search(text) and len(text) > 3:
                cluster = text
            continue
        m = CCSS_CODE.search(text)
        if not m:
            continue
        code = m.group(0).rstrip(".")
        body = text[m.end():].lstrip(" .:—–-").strip() or text
        if code in standards:
            continue
        short = _short_from_full(code)
        standards[code] = {
            "subject": subject,
            "grade": grade,
            "domain": domain,
            "cluster": cluster,
            "standard_code": code,
            "short_code": short,
            "standard_text": body,
            "parent_code": _parent_of(short),
            "source_url": url,
        }


def live_scrape() -> tuple[list[dict], int, list[str]]:
    """Run the live BFS crawler. Returns (standards, pages_crawled, skipped)."""
    standards: dict[str, dict] = {}
    visited: set[str] = set()
    skipped: list[str] = []
    queue: list[str] = list(SEED_URLS)
    queue_set: set[str] = set(queue)
    pages = 0

    print(f"[live] Seeding with {len(queue)} URLs", file=sys.stderr)
    while queue and pages < MAX_PAGES:
        url = queue.pop(0)
        queue_set.discard(url)
        if url in visited:
            continue
        visited.add(url)
        try:
            time.sleep(REQUEST_DELAY)
            resp = requests.get(url, headers=HEADERS, timeout=20)
            resp.raise_for_status()
        except requests.RequestException as exc:
            skipped.append(url)
            print(f"  [SKIP] {type(exc).__name__}: {url}", file=sys.stderr)
            continue

        pages += 1
        before = len(standards)
        _parse_html_page(resp.text, url, standards)
        added = len(standards) - before
        print(f"  [{pages}] +{added} standards  {url}", file=sys.stderr)

        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = urljoin(url, a["href"]).split("#")[0]
            if _should_follow(href, visited, queue_set):
                queue.append(href)
                queue_set.add(href)

    return list(standards.values()), pages, skipped


# ---------------------------------------------------------------------------
# Offline fallback — @weo-edu/standards npm tarball
# ---------------------------------------------------------------------------


def _weo_grade_to_label(filename: str) -> str:
    stem = Path(filename).stem
    if stem == "grade-k":
        return "K"
    m = re.match(r"grade-(\d+)$", stem)
    if m:
        return m.group(1)
    if stem.startswith("grades-"):
        return "HS"
    return "K-12"


def _build_full_code(subject: str, grade: str, short: str, domain: str) -> str:
    if subject == "Math":
        if grade == "HS":
            first_letter = short.split(".", 1)[0].upper()
            prefix = HS_PREFIX_MAP.get(first_letter, "HSA")
            tail = short.split(".", 1)[1] if "." in short else short
            return f"CCSS.Math.Content.{prefix}.{tail}"
        return f"CCSS.Math.Content.{short}"
    if subject == "ELA-Literacy":
        return f"CCSS.ELA-Literacy.{short}"
    return short


def _source_url_for(subject: str, grade: str, short: str) -> str:
    if subject == "ELA-Literacy":
        strand = short.split(".", 1)[0]
        gp = grade if grade != "HS" else "11-12"
        return f"{BASE_URL}/ELA-Literacy/{strand}/{gp}/"
    if subject == "Math":
        if grade == "HS":
            first = short.split(".", 1)[0].upper()
            return f"{BASE_URL}/Math/Content/{HS_PREFIX_MAP.get(first, 'HSA')}/"
        parts = short.split(".")
        if len(parts) >= 3:
            return f"{BASE_URL}/Math/Content/{grade}/{parts[1]}/"
        return f"{BASE_URL}/Math/Content/{grade}/"
    return BASE_URL


def _read_weo_tarball(tar_path: Path) -> dict[str, dict]:
    out: dict[str, dict] = defaultdict(dict)
    with tarfile.open(tar_path, "r:gz") as tf:
        for m in tf.getmembers():
            if not m.isfile() or "/subjects/" not in m.name or not m.name.endswith(".json"):
                continue
            parts = m.name.split("/")
            try:
                i = parts.index("subjects")
                subj = parts[i + 1]
                fname = parts[i + 2]
            except (ValueError, IndexError):
                continue
            if subj not in ("mathematics", "english-language-arts-and-literacy"):
                continue
            f = tf.extractfile(m)
            if not f:
                continue
            out[subj][fname] = json.loads(f.read().decode("utf-8"))
    return out


def offline_import() -> list[dict]:
    """Parse the bundled weo-edu tarball into the same output schema as the live scraper."""
    tar_path = VENDOR_DIR / "weo-edu-standards-0.1.6.tgz"
    if not tar_path.exists():
        print(f"[offline] vendor tarball missing: {tar_path}", file=sys.stderr)
        return []

    print(f"[offline] reading {tar_path}", file=sys.stderr)
    raw = _read_weo_tarball(tar_path)
    out: dict[str, dict] = {}

    for weo_subject, files in raw.items():
        subject = "Math" if weo_subject == "mathematics" else "ELA-Literacy"
        for fname, data in files.items():
            grade = _weo_grade_to_label(fname)
            if not isinstance(data, dict):
                continue
            for top_key, items in data.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    short = (item.get("displayName") or "").strip()
                    text = _normalise(item.get("content") or "")
                    if not short or not text:
                        continue
                    meta = item.get("meta") or []
                    domain = _normalise(meta[-1]) if meta else ""
                    cluster = _normalise(meta[-2]) if len(meta) >= 2 else ""
                    # Prefer top_key when it looks like a domain rather than a cluster
                    if top_key and len(top_key) < 80 and not top_key.endswith("."):
                        domain = top_key
                    code = _build_full_code(subject, grade, short, domain)
                    if code in out:
                        continue
                    out[code] = {
                        "subject": subject,
                        "grade": grade,
                        "domain": domain,
                        "cluster": cluster,
                        "standard_code": code,
                        "short_code": short,
                        "standard_text": text,
                        "parent_code": _parent_of(short),
                        "source_url": _source_url_for(subject, grade, short),
                    }

    # Add Mathematical Practice standards (not in the weo grade files)
    practice = [
        ("MP1", "Make sense of problems and persevere in solving them."),
        ("MP2", "Reason abstractly and quantitatively."),
        ("MP3", "Construct viable arguments and critique the reasoning of others."),
        ("MP4", "Model with mathematics."),
        ("MP5", "Use appropriate tools strategically."),
        ("MP6", "Attend to precision."),
        ("MP7", "Look for and make use of structure."),
        ("MP8", "Look for and express regularity in repeated reasoning."),
    ]
    for short, text in practice:
        code = f"CCSS.Math.Practice.{short}"
        out[code] = {
            "subject": "Math",
            "grade": "K-12",
            "domain": "Standards for Mathematical Practice",
            "cluster": "",
            "standard_code": code,
            "short_code": short,
            "standard_text": text,
            "parent_code": None,
            "source_url": f"{BASE_URL}/Math/Practice/",
        }

    return list(out.values())


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------


def _sort_grade(g: str) -> tuple:
    if g == "K":
        return (0, 0)
    if g == "HS":
        return (0, 100)
    if g == "K-12":
        return (0, 200)
    try:
        return (0, int(g))
    except ValueError:
        return (1, 0)


def write_outputs(standards: list[dict], mode: str, pages: int, skipped: list[str]):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    by_code: dict[str, dict] = {}
    for s in standards:
        by_code.setdefault(s["standard_code"], s)
    deduped = sorted(
        by_code.values(),
        key=lambda s: (s["subject"], _sort_grade(s["grade"]), s["domain"], s["standard_code"]),
    )
    duplicates_removed = len(standards) - len(deduped)

    meta = {
        "source": "https://www.thecorestandards.org/",
        "mode": mode,
        "pages_crawled": pages,
        "pages_skipped": len(skipped),
        "duplicates_removed": duplicates_removed,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(deduped),
        "subjects": sorted({s["subject"] for s in deduped}),
        "note": (
            "Common Core State Standards. © Copyright 2010 National Governors "
            "Association Center for Best Practices and Council of Chief State "
            "School Officers. All rights reserved."
        ),
    }
    payload = {"meta": meta, "standards": deduped}

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"✓ JSON   → {JSON_OUT}")

    fieldnames = [
        "subject", "grade", "domain", "cluster",
        "standard_code", "short_code", "standard_text",
        "parent_code", "source_url",
    ]
    if HAS_PANDAS:
        pd.DataFrame(deduped)[fieldnames].to_csv(CSV_OUT, index=False, encoding="utf-8")
    else:
        with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(deduped)
    print(f"✓ CSV    → {CSV_OUT}")

    with open(PUBLIC_JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"✓ Public → {PUBLIC_JSON_OUT}")

    by_subject: dict[str, int] = defaultdict(int)
    by_grade: dict[str, int] = defaultdict(int)
    for s in deduped:
        by_subject[s["subject"]] += 1
        by_grade[s["grade"]] += 1

    print("\n=== SUMMARY ===")
    print(f"Mode                : {mode}")
    print(f"Total standards     : {len(deduped)}")
    print(f"Math standards      : {by_subject.get('Math', 0)}")
    print(f"ELA-Literacy        : {by_subject.get('ELA-Literacy', 0)}")
    print(f"Pages crawled       : {pages}")
    print(f"Pages skipped       : {len(skipped)}")
    print(f"Duplicates removed  : {duplicates_removed}")
    print("\nBy grade:")
    for k, v in sorted(by_grade.items(), key=lambda kv: _sort_grade(kv[0])):
        print(f"  {k:<6} {v}")
    if skipped:
        print(f"\nSkipped URLs ({len(skipped)}):")
        for u in skipped[:10]:
            print(f"  {u}")
        if len(skipped) > 10:
            print(f"  … and {len(skipped) - 10} more")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Scrape CCSS from thecorestandards.org.")
    parser.add_argument("--offline", action="store_true",
                        help="Skip live scrape; use bundled npm fallback.")
    parser.add_argument("--force-live", action="store_true",
                        help="Fail if live scrape yields fewer than %d standards." % MIN_LIVE_STANDARDS)
    args = parser.parse_args()

    if args.offline:
        standards, mode, pages, skipped = offline_import(), "offline", 0, []
    else:
        try:
            standards, pages, skipped = live_scrape()
        except Exception as exc:
            print(f"[live] fatal error: {exc}", file=sys.stderr)
            standards, pages, skipped = [], 0, []
        mode = "live"
        if len(standards) < MIN_LIVE_STANDARDS:
            if args.force_live:
                print(f"[live] got only {len(standards)} standards (< {MIN_LIVE_STANDARDS}); --force-live aborting",
                      file=sys.stderr)
                sys.exit(1)
            print(f"\n[fallback] Live scrape returned {len(standards)} standards "
                  f"(< {MIN_LIVE_STANDARDS}). Falling back to bundled npm dataset.\n",
                  file=sys.stderr)
            standards = offline_import()
            mode = "offline (auto-fallback)"

    if not standards:
        print("\n[ERROR] No standards collected.", file=sys.stderr)
        sys.exit(1)
    write_outputs(standards, mode, pages, skipped)


if __name__ == "__main__":
    main()
