#!/usr/bin/env python3
"""
Validate data/common_core_standards.json.

Checks:
  * JSON is valid and has the expected top-level shape
  * Every standard has every required field populated
  * Every standard_code is unique
  * Every standard_code starts with "CCSS."
  * Counts by subject, grade, domain

Usage:
    python3 scripts/validate_common_core_standards.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
DATA_FILE = PROJECT_ROOT / "data" / "common_core_standards.json"

REQUIRED_FIELDS = (
    "subject",
    "grade",
    "domain",
    "standard_code",
    "standard_text",
    "source_url",
)
OPTIONAL_FIELDS = ("cluster", "short_code", "parent_code")


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


def main() -> int:
    if not DATA_FILE.exists():
        print(f"[FAIL] Data file not found: {DATA_FILE}", file=sys.stderr)
        print("       Run: python3 scripts/scrape_common_core_standards.py --offline")
        return 1

    with open(DATA_FILE, encoding="utf-8") as f:
        payload = json.load(f)

    # Shape check — accept either {"standards": [...]} wrapper or bare list
    if isinstance(payload, dict) and "standards" in payload:
        standards = payload["standards"]
        meta = payload.get("meta", {})
    elif isinstance(payload, list):
        standards = payload
        meta = {}
    else:
        print("[FAIL] Top-level JSON must be a list or {meta, standards} object", file=sys.stderr)
        return 1

    if not isinstance(standards, list) or not standards:
        print("[FAIL] No standards in dataset", file=sys.stderr)
        return 1

    missing = defaultdict(int)
    bad_code_prefix = 0
    by_subject = Counter()
    by_grade = Counter()
    by_domain = Counter()
    by_subject_grade = Counter()
    codes = Counter()

    for s in standards:
        if not isinstance(s, dict):
            missing["not_an_object"] += 1
            continue
        for f in REQUIRED_FIELDS:
            if not s.get(f):
                missing[f] += 1
        code = s.get("standard_code", "")
        if code:
            codes[code] += 1
            if not code.startswith("CCSS."):
                bad_code_prefix += 1
        by_subject[s.get("subject", "")] += 1
        by_grade[s.get("grade", "")] += 1
        by_domain[f"{s.get('subject','')} / {s.get('domain','')}"] += 1
        by_subject_grade[(s.get("subject", ""), s.get("grade", ""))] += 1

    duplicate_codes = {c: n for c, n in codes.items() if n > 1}

    print("=" * 60)
    print("  COMMON CORE STANDARDS VALIDATION")
    print("=" * 60)
    print(f"File                : {DATA_FILE}")
    if meta:
        print(f"Generated at        : {meta.get('generated_at','?')}")
        print(f"Source mode         : {meta.get('mode','?')}")
    print(f"Total standards     : {len(standards)}")
    print(f"Unique codes        : {len(codes)}")
    print(f"Duplicate codes     : {len(duplicate_codes)}")
    print(f"Bad code prefix     : {bad_code_prefix}")
    print()

    print("Missing required fields:")
    if not missing:
        print("  none — all required fields present")
    else:
        for field, count in sorted(missing.items(), key=lambda kv: -kv[1]):
            print(f"  {field:<20} missing in {count} standards")
    print()

    print("By subject:")
    for k, v in sorted(by_subject.items()):
        print(f"  {k:<15} {v}")
    print()

    print("By grade:")
    for k, v in sorted(by_grade.items(), key=lambda kv: _sort_grade(kv[0])):
        print(f"  {k:<6} {v}")
    print()

    print("By subject × grade:")
    for (subj, grade), v in sorted(by_subject_grade.items(),
                                    key=lambda kv: (kv[0][0], _sort_grade(kv[0][1]))):
        print(f"  {subj:<15} {grade:<6} {v}")
    print()

    print(f"Unique domains      : {len({d.split(' / ', 1)[-1] for d in by_domain if ' / ' in d})}")
    print("Top 10 domains by standard count:")
    for d, v in by_domain.most_common(10):
        print(f"  {v:4}  {d}")
    print()

    # Exit code: non-zero on any hard failure
    failed = len(duplicate_codes) > 0 or missing.get("standard_code", 0) > 0 or bad_code_prefix > 0
    if duplicate_codes:
        print(f"[FAIL] {len(duplicate_codes)} duplicate codes — first 5:")
        for c in list(duplicate_codes)[:5]:
            print(f"       {c} × {duplicate_codes[c]}")
    if missing.get("standard_code"):
        print(f"[FAIL] {missing['standard_code']} standards missing standard_code")
    if bad_code_prefix:
        print(f"[FAIL] {bad_code_prefix} standards with non-CCSS code prefix")
    if failed:
        return 1

    print("[PASS] Validation successful")
    return 0


if __name__ == "__main__":
    sys.exit(main())
