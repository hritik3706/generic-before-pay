# The Prescription You Cannot Read

Make the cost of medicine visible before it is paid.

A patient is handed a prescription of brand names, takes it to a chemist, and pays what they are told. For a large share of those drugs an identical generic exists at a fraction of the price: the same molecule, the same strength, a different name on the box. Jan Aushadhi Kendras stock them and publish their prices openly.

The patient has no way to know. They do not know the molecule, they cannot read the handwriting, and they are not going to argue at the counter. That gap is paid for in cash, by the people least able to.

## What a judge should be able to use

The smallest version comes first. Nothing else is built until this works.

1. Enter a brand name or a molecule.
2. Get back the generic name, the strength, and an indicative price for the generic against the branded one.
3. Make the saving the headline. `₹240 → ₹28` is the product; everything else is detail.
4. Tolerate bad input: misspellings, missing strengths, a half-read word off a prescription. Nobody types a drug name correctly the first time.
5. Carry a clear disclaimer and mean it. This is price and molecule information, not medical advice. Never suggest a substitution decision. Say to confirm with the doctor or pharmacist.

## If that works

These come after the smallest version, in this order of value:

- Photograph the strip or box and read the name off it.
- A whole prescription at once, with a total saving.
- The nearest Jan Aushadhi Kendra.
- A printable sheet to hand across the counter.
- A pill identifier by imprint.

Typing remains the path that always works. OCR, if attempted, is limited to printed strips and boxes. Handwriting is out of scope.

## Data

Prices and names come from published lists, shipped with the project:

- Jan Aushadhi product list and prices.
- National Pharmaceutical Pricing Authority (NPPA) ceiling prices, where they apply.

A cleaned subset is bundled as CSV or JSON in the repo. Curating about 200 common drugs well is the target. A badly scraped catalogue of 20,000 is not.

## Rules that keep this safe

- **Look up, do not invent.** Drug names, strengths, and prices are read from the shipped data. If a name is not in that data, the app says so. A language model is never used to generate drug information. A hallucinated dosage is a harm.
- **Fuzzy matching is the core.** Plain string matching fails on the first real prescription. Misspellings and partial words have to resolve to a row in the data, or to an honest miss.
- **Information, not a decision.** The app shows molecule, strength, and indicative prices. It does not tell anyone to switch. The disclaimer says to confirm with the doctor or pharmacist, and the interface does not undermine that sentence.
- **Unknown stays unknown.** A missing strength, an unmatched name, or a price that is not in the bundle is shown as missing. It is not filled in.

## Disclaimer (product copy)

> This shows published generic names and indicative prices for medicines already named. It is not medical advice and it is not a recommendation to substitute. Confirm the medicine, the strength, and the price with your doctor or pharmacist before you buy or change anything.

---

## Backend: Quickstart & Runbook

### Documentation
- 📋 [Drug Data Schema](docs/drug-data-schema.md) — Attribute definitions, validation rules, and safety blacklist.
- 📡 [REST API Contract](docs/api-contract.md) — Request/response shapes, error formats, and ETag caching rules.

### Prerequisites & Setup
Ensure Python 3.10+ is installed:
```bash
pip install -r requirements.txt
```

### Run the API Server
Start the FastAPI server with hot-reload:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Core Endpoints & Example cURL Calls

Base URL: `http://127.0.0.1:8000/api/v1` *(or `/api` fallback)*

#### 1. Fuzzy Search (`GET /api/v1/search?q={query}&limit=3`)
Tolerates typos (e.g. `paracetmol`, `crocin 500mg`), missing strengths, and searches both brand and molecule.
```bash
curl "http://127.0.0.1:8000/api/v1/search?q=crocin%20500mg"
```
```json
{
  "success": true,
  "data": {
    "query": "crocin 500mg",
    "total_matches": 2,
    "matches": [
      {
        "id": "crocin-advance-tab",
        "brand_name": "Crocin Advance",
        "molecule": "Paracetamol (Fast Release)",
        "strength": "500 mg",
        "unit": "strip of 20 tablets",
        "branded_price": 42.0,
        "generic_price": 10.0,
        "savings_amount": 32.0,
        "savings_percentage": 76.2,
        "confidence_score": 1.0,
        "match_type": "alias_exact"
      }
    ]
  },
  "disclaimer": "This shows published generic names and indicative prices for medicines already named. It is not medical advice and it is not a recommendation to substitute. Confirm the medicine, the strength, and the price with your doctor or pharmacist before you buy or change anything."
}
```

#### 2. Drug Detail (`GET /api/v1/drugs/{id}`)
```bash
curl "http://127.0.0.1:8000/api/v1/drugs/paracetamol-500mg-tab"
```

#### 3. Prescription Savings Basket (`POST /api/v1/compare`)
Accepts either structured `items` with quantities or a simple `ids` array. Automatically merges duplicates and tolerates empty baskets gracefully.
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/compare" \
     -H "Content-Type: application/json" \
     -d '{"items": [{"id": "paracetamol-500mg-tab", "quantity": 2}, {"id": "metformin-500mg-tab", "quantity": 1}]}'
```
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_items": 2,
      "total_units": 3,
      "total_branded_cost": 93.0,
      "total_generic_cost": 15.0,
      "total_savings": 78.0,
      "overall_savings_percentage": 83.9,
      "currency": "INR",
      "skipped_ids": []
    },
    "breakdown": [...]
  },
  "disclaimer": "This shows published generic names and indicative prices for medicines already named. It is not medical advice and it is not a recommendation to substitute. Confirm the medicine, the strength, and the price with your doctor or pharmacist before you buy or change anything."
}
```

#### 4. Offline Version Check (`GET /api/v1/data/version`)
Returns deterministic content-based version and SHA-256 hash.
```bash
curl "http://127.0.0.1:8000/api/v1/data/version"
```

#### 5. Offline Data Bundle Sync (`GET /api/v1/data/bundle`)
Includes HTTP `ETag` and `Cache-Control: public, max-age=3600`. Supports conditional `If-None-Match` returning `304 Not Modified`.
```bash
curl -i "http://127.0.0.1:8000/api/v1/data/bundle"
```

---

### Integration & Architecture Notes
- **Zero Hallucination / Bundled Offline Store**: The dataset (215 curated essential Indian medicines) is shipped locally and stored in SQLite. **Zero external APIs or LLMs are invoked during search**.
- **CORS Configured for Frontend Dev**: Pre-configured to accept requests and credentials from `http://localhost:5173` (Vite), `http://localhost:3000` (Next.js/React), `http://localhost:8080`, and any local port regex.
- **Sub-millisecond LRU Caching**: Repeated queries hit an in-memory LRU cache keyed by dataset content hash.

### Run Automated Tests (26 Tests)
```bash
python -m pytest tests/ -v
```

### Dataset Validation & Normalization
```bash
python scripts/validate_and_normalize.py
```


