# Common Core Standards Import

Scrapes Math and ELA/Literacy standards from
[thecorestandards.org](https://www.thecorestandards.org/) and saves them
as JSON and CSV files that can be used throughout the app.

---

## Prerequisites

Python 3.9+ and pip are required (the rest of the app only needs Node.js).

```bash
pip install requests beautifulsoup4 pandas
```

---

## Running the scraper

From the project root:

```bash
python3 scripts/scrape_common_core_standards.py
```

The scraper:

- Visits `thecorestandards.org/Math/` and `thecorestandards.org/ELA-Literacy/`
- Discovers every grade/strand page and fetches it with a 1.5-second delay
- Extracts standard code, text, subject, grade, domain, and cluster
- Skips broken pages (prints a `[SKIP]` line for each) and continues
- De-duplicates by `code + text`
- **Exits with code 1** if no standards were extracted at all (site structure changed)

Total runtime is roughly **3–6 minutes** (network-bound, ~80–120 pages).

---

## Output files

| File | Description |
|------|-------------|
| `data/common_core_standards.json` | Canonical output — array of standard objects + metadata header |
| `data/common_core_standards.csv` | Same data as a flat CSV (useful for spreadsheets / database imports) |
| `public/data/common_core_standards.json` | Auto-copied here so Vite serves it at `/data/common_core_standards.json` |

The `data/` directory at the project root is the source of truth.
`public/data/` is derived from it — **do not edit it directly**.

### JSON structure

```jsonc
{
  "meta": {
    "source": "https://www.thecorestandards.org/",
    "subjects": ["Math", "ELA-Literacy"],
    "total": 1234,
    "note": "© 2010 NGA/CCSSO. All rights reserved."
  },
  "standards": [
    {
      "subject":  "Math",
      "grade":    "Kindergarten",
      "domain":   "Counting & Cardinality",
      "cluster":  "Know number names and the count sequence.",
      "code":     "CCSS.Math.Content.K.CC.A.1",
      "text":     "Count to 100 by ones and by tens.",
      "url":      "https://www.thecorestandards.org/Math/Content/K/"
    }
  ]
}
```

---

## Using the data in the app

### Option A — JavaScript helper (recommended)

`src/lib/standards.js` loads the JSON at runtime via `fetch` and exposes
async helper functions.

```js
import {
  getAllStandards,
  getStandardsBySubject,
  getStandardsByGrade,
  searchStandards,
  getSubjects,
  getGradesBySubject,
} from '@/lib/standards';

// All standards
const all = await getAllStandards();

// Only Math standards
const math = await getStandardsBySubject('Math');

// Grade 3 standards across all subjects
const grade3 = await getStandardsByGrade('Grade 3');

// Full-text / code search
const results = await searchStandards('multiplication');

// List subjects in the dataset
const subjects = await getSubjects();          // ['ELA-Literacy', 'Math']

// Grades available for a subject
const grades = await getGradesBySubject('Math');
```

> **Note:** The JSON is fetched from `/data/common_core_standards.json`.
> Vite serves this from `public/data/`. The scraper copies the file there
> automatically. If you re-run the scraper, it updates both locations.

### Option B — Direct JSON import (bundles into the app)

If you prefer a static import (no network request, but increases bundle size):

```js
import data from '../../data/common_core_standards.json';
const standards = data.standards;
```

### Option C — Database import

Use the CSV to seed a database table. Example with the existing Drizzle
setup (pseudo-code):

```js
import fs from 'fs';
const { standards } = JSON.parse(
  fs.readFileSync('data/common_core_standards.json', 'utf8')
);
await db.insert(ccStandardsTable).values(standards);
```

---

## Re-running / updating

Re-run the script at any time to get updated data. Duplicate standards are
automatically skipped. Because the site changes infrequently (the Common Core
was finalised in 2010), one scrape is usually sufficient.

---

## Attribution

Common Core State Standards © 2010 National Governors Association Center for
Best Practices (NGA Center) and the Council of Chief State School Officers
(CCSSO). All rights reserved. See
[thecorestandards.org](https://www.thecorestandards.org) for terms of use.
