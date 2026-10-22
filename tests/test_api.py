"""
tests/test_api.py

Automated test suite for Generic Before Pay API.
Tests:
- Search accuracy, fuzzy matching, and misspelling tolerance
- Partial names and missing strengths
- Top-3 candidate ranking
- Drug detail retrieval and 404 not-found handling
- Prescription compare basket calculations
- Mandatory disclaimer presence across all endpoints
- Strict absence of forbidden advice/dosage fields
- Offline sync endpoints (version and bundle)
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.dal import STANDARD_DISCLAIMER

FORBIDDEN_KEYS = {
    "dosage",
    "dosage_instructions",
    "frequency",
    "duration",
    "course",
    "substitution_advice",
    "recommendation",
    "advice"
}


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def _assert_no_forbidden_fields(data):
    """Recursively verify no forbidden medical advice fields are present."""
    if isinstance(data, dict):
        for k, v in data.items():
            assert k.lower() not in FORBIDDEN_KEYS, f"Forbidden field '{k}' found in response!"
            _assert_no_forbidden_fields(v)
    elif isinstance(data, list):
        for item in data:
            _assert_no_forbidden_fields(item)


def test_search_exact_match(client):
    response = client.get("/api/v1/search?q=Calpol 500")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER
    matches = json_data["data"]["matches"]
    assert len(matches) >= 1
    assert matches[0]["brand_name"] == "Calpol 500"
    assert matches[0]["confidence_score"] >= 0.90
    _assert_no_forbidden_fields(json_data)


def test_search_fuzzy_misspelling(client):
    # Typo: 'clpol' instead of 'calpol'
    response = client.get("/api/v1/search?q=clpol")
    assert response.status_code == 200
    json_data = response.json()
    matches = json_data["data"]["matches"]
    assert len(matches) > 0
    assert matches[0]["brand_name"] == "Calpol 500"
    assert matches[0]["confidence_score"] >= 0.70
    _assert_no_forbidden_fields(json_data)


def test_search_missing_strength_returns_candidates(client):
    # Query without strength: 'glycomet'
    response = client.get("/api/v1/search?q=glycomet")
    assert response.status_code == 200
    json_data = response.json()
    matches = json_data["data"]["matches"]
    # Should return candidates with distinct strengths (e.g. 500 mg, 1000 mg)
    assert len(matches) >= 2
    strengths = {m["strength"] for m in matches}
    assert "500 mg" in strengths
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER
    _assert_no_forbidden_fields(json_data)


def test_search_top_3_limit(client):
    response = client.get("/api/v1/search?q=tab&limit=3")
    assert response.status_code == 200
    matches = response.json()["data"]["matches"]
    assert len(matches) <= 3


def test_search_not_found_returns_empty_matches(client):
    response = client.get("/api/v1/search?q=xyznonexistentdrug999")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["total_matches"] == 0
    assert json_data["data"]["matches"] == []
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER


def test_drug_detail_success(client):
    response = client.get("/api/v1/drugs/paracetamol-500mg-tab")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    data = json_data["data"]
    assert data["id"] == "paracetamol-500mg-tab"
    assert data["brand_name"] == "Calpol 500"
    assert data["molecule"] == "Paracetamol"
    assert data["strength"] == "500 mg"
    assert data["branded_price"] == 32.50
    assert data["generic_price"] == 5.00
    assert data["savings_amount"] == 27.50
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER
    _assert_no_forbidden_fields(json_data)


def test_drug_detail_not_found(client):
    response = client.get("/api/v1/drugs/unknown-drug-id-999")
    assert response.status_code == 404
    json_data = response.json()
    assert json_data["success"] is False
    assert json_data["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_compare_prescriptions(client):
    payload = {
        "items": [
            {"id": "paracetamol-500mg-tab", "quantity": 2},
            {"id": "metformin-500mg-tab", "quantity": 1}
        ]
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    summary = json_data["data"]["summary"]
    breakdown = json_data["data"]["breakdown"]

    # 2 * 32.50 + 1 * 28.00 = 65.00 + 28.00 = 93.00
    assert summary["total_branded_cost"] == 93.00
    # 2 * 5.00 + 1 * 5.00 = 15.00
    assert summary["total_generic_cost"] == 15.00
    assert summary["total_savings"] == 78.00
    assert summary["overall_savings_percentage"] == 83.9
    assert len(breakdown) == 2
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER
    _assert_no_forbidden_fields(json_data)


def test_compare_empty_items_returns_200(client):
    """Empty basket must return 200 with 0 totals and disclaimer, never 422 or 500."""
    response = client.post("/api/v1/compare", json={"items": []})
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["summary"]["total_items"] == 0
    assert json_data["data"]["summary"]["total_savings"] == 0.0
    assert json_data["data"]["breakdown"] == []
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER


def test_compare_with_ids_array(client):
    """Client can pass simple 'ids' array instead of 'items' objects."""
    response = client.post("/api/v1/compare", json={"ids": ["paracetamol-500mg-tab", "metformin-500mg-tab"]})
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["summary"]["total_items"] == 2
    assert json_data["data"]["summary"]["total_savings"] > 0


def test_compare_duplicate_ids_merging(client):
    """Duplicate IDs in request must merge quantities, not duplicate rows."""
    payload = {
        "items": [
            {"id": "paracetamol-500mg-tab", "quantity": 1},
            {"id": "paracetamol-500mg-tab", "quantity": 2}
        ]
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data["breakdown"]) == 1
    assert data["breakdown"][0]["quantity"] == 3
    # 3 * 32.50 = 97.50, 3 * 5.00 = 15.00, savings = 82.50
    assert data["breakdown"][0]["item_savings"] == 82.50
    assert data["summary"]["total_savings"] == 82.50


def test_compare_unknown_id_gracefully_skipped(client):
    """Unknown ID should be tracked in skipped_ids and return 200, never crash 500."""
    payload = {
        "items": [
            {"id": "paracetamol-500mg-tab", "quantity": 1},
            {"id": "completely-fake-drug-id", "quantity": 1}
        ]
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["summary"]["total_items"] == 1
    assert "completely-fake-drug-id" in data["summary"]["skipped_ids"]


def test_compare_math_accuracy(client):
    """Verify sum of item_savings exactly equals total_savings."""
    payload = {
        "items": [
            {"id": "paracetamol-500mg-tab", "quantity": 2},
            {"id": "metformin-500mg-tab", "quantity": 3},
            {"id": "atorvastatin-10mg-tab", "quantity": 1}
        ]
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 200
    summary = response.json()["data"]["summary"]
    breakdown = response.json()["data"]["breakdown"]

    sum_savings = round(sum(it["item_savings"] for it in breakdown), 2)
    assert summary["total_savings"] == sum_savings
    expected_pct = round((summary["total_savings"] / summary["total_branded_cost"]) * 100, 1)
    assert summary["overall_savings_percentage"] == expected_pct


def test_offline_data_version(client):
    response = client.get("/api/v1/data/version")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["data"]["total_records"] >= 200
    assert "dataset_hash" in json_data["data"]
    # Check deterministic content-based version prefix
    assert json_data["data"]["dataset_version"].startswith("v1.")


def test_offline_data_bundle_cache_control_and_etag(client):
    response = client.get("/api/v1/data/bundle")
    assert response.status_code == 200
    etag = response.headers.get("etag")
    cache_control = response.headers.get("cache-control")
    assert etag is not None
    assert cache_control == "public, max-age=3600"

    json_data = response.json()
    assert json_data["success"] is True
    assert len(json_data["drugs"]) >= 200
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER
    _assert_no_forbidden_fields(json_data)

    # Test 304 Not Modified when ETag matches
    cached_response = client.get("/api/v1/data/bundle", headers={"If-None-Match": etag})
    assert cached_response.status_code == 304
    assert cached_response.headers.get("etag") == etag
    assert cached_response.headers.get("cache-control") == "public, max-age=3600"


def test_search_paracetmol_and_crocin_misspellings(client):
    # Case 1: 'Paracetmol' misspelling
    r1 = client.get("/api/v1/search?q=Paracetmol")
    assert r1.status_code == 200
    matches1 = r1.json()["data"]["matches"]
    assert len(matches1) >= 1
    names1 = [m["brand_name"] for m in matches1]
    assert "Calpol 500" in names1 or "Dolo 650" in names1
    assert matches1[0]["confidence_score"] >= 0.80

    # Case 2: 'Crocin 500' alias
    r2 = client.get("/api/v1/search?q=Crocin 500")
    assert r2.status_code == 200
    matches2 = r2.json()["data"]["matches"]
    assert len(matches2) >= 1
    assert matches2[0]["confidence_score"] >= 0.90


def test_dual_route_prefix(client):
    # Test unversioned /api/ path
    r_unversioned = client.get("/api/search?q=Dolo 650")
    assert r_unversioned.status_code == 200
    assert r_unversioned.json()["data"]["matches"][0]["brand_name"] == "Dolo 650"

    r_bundle = client.get("/api/data/version")
    assert r_bundle.status_code == 200
    assert r_bundle.json()["data"]["total_records"] >= 200


def test_disclaimer_present_in_error_responses(client):
    r_404 = client.get("/api/v1/drugs/non-existent-drug-1234")
    assert r_404.status_code == 404
    assert r_404.json()["disclaimer"] == STANDARD_DISCLAIMER

    r_422 = client.post("/api/v1/compare", json={"items": "invalid_string_type"})
    assert r_422.status_code == 422
    assert r_422.json()["disclaimer"] == STANDARD_DISCLAIMER


def test_dataset_size_at_least_200_records(client):
    response = client.get("/api/v1/data/version")
    assert response.status_code == 200
    total = response.json()["data"]["total_records"]
    assert total >= 200, f"Dataset has only {total} records, expected at least 200!"


def test_search_by_molecule_paracetamol(client):
    """Search by molecule 'Paracetamol' must return Crocin/Dolo/Calpol."""
    response = client.get("/api/v1/search?q=Paracetamol")
    assert response.status_code == 200
    data = response.json()["data"]
    matches = data["matches"]
    assert len(matches) >= 2
    matched_names = {m["brand_name"] for m in matches}
    # Must contain common Paracetamol brands
    assert any(name in matched_names for name in ["Calpol 500", "Dolo 650", "Crocin Advance"])
    # All returned items must have Paracetamol as active molecule
    for m in matches:
        assert "Paracetamol" in m["molecule"]
        assert m["confidence_score"] >= 0.85


def test_search_by_brand_crocin(client):
    """Search by brand 'Crocin' must return Crocin."""
    response = client.get("/api/v1/search?q=Crocin")
    assert response.status_code == 200
    matches = response.json()["data"]["matches"]
    assert len(matches) >= 1
    matched_names = [m["brand_name"] for m in matches]
    assert "Crocin Advance" in matched_names or "Calpol 500" in matched_names
    assert matches[0]["confidence_score"] == 1.0


def test_search_by_molecule_and_strength(client):
    """Search by molecule + strength combination."""
    r1 = client.get("/api/v1/search?q=Metformin 500")
    assert r1.status_code == 200
    m1 = r1.json()["data"]["matches"]
    assert len(m1) >= 1
    assert m1[0]["brand_name"] == "Glycomet 500"
    assert m1[0]["strength"] == "500 mg"
    assert m1[0]["confidence_score"] >= 0.95

    r2 = client.get("/api/v1/search?q=Atorvastatin 20")
    assert r2.status_code == 200
    m2 = r2.json()["data"]["matches"]
    assert len(m2) >= 1
    assert m2[0]["brand_name"] == "Atorva 20"
    assert m2[0]["strength"] == "20 mg"
    assert m2[0]["confidence_score"] >= 0.95


def test_ten_real_world_misspellings_benchmark(client):
    """
    Audit Flaw 3: Test 10 real-world prescription typos.
    All 10 must resolve to their correct intended active molecules.
    """
    cases = [
        ("paracetmol", "Paracetamol"),
        ("crocin 500", "Paracetamol"),
        ("azithromicin", "Azithromycin"),
        ("metformn", "Metformin"),
        ("amlodipne", "Amlodipine"),
        ("pantoprazol", "Pantoprazole"),
        ("cetrizine", "Cetirizine"),
        ("omeprazol", "Omeprazole"),
        ("ibuprofn", "Ibuprofen"),
        ("ranitidin", "Ranitidine")
    ]

    for typo, expected_molecule in cases:
        response = client.get(f"/api/v1/search?q={typo}")
        assert response.status_code == 200, f"Failed for {typo}"
        matches = response.json()["data"]["matches"]
        assert len(matches) >= 1, f"No matches found for misspelling '{typo}'"
        top_match = matches[0]
        assert expected_molecule.lower() in top_match["molecule"].lower(), (
            f"Misspelling '{typo}' resolved to '{top_match['molecule']}', expected '{expected_molecule}'"
        )
        assert top_match["confidence_score"] >= 0.55, f"Confidence score too low for '{typo}': {top_match['confidence_score']}"


def test_search_attached_strength(client):
    """Test attached strength tokens (e.g. 'Crocin 500mg', 'Dolo 650mg')."""
    r1 = client.get("/api/v1/search?q=Crocin 500mg")
    assert r1.status_code == 200
    m1 = r1.json()["data"]["matches"]
    assert len(m1) >= 1
    assert any("Crocin" in it["brand_name"] or "Calpol" in it["brand_name"] for it in m1)
    assert m1[0]["strength"] == "500 mg"

    r2 = client.get("/api/v1/search?q=Dolo 650mg")
    assert r2.status_code == 200
    m2 = r2.json()["data"]["matches"]
    assert len(m2) >= 1
    assert m2[0]["brand_name"] == "Dolo 650"
    assert m2[0]["strength"] == "650 mg"


def test_cors_headers_and_preflight(client):
    """Test CORS allows frontend origins (e.g. Vite on 5173, Next.js on 3000)."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
    }
    # Preflight OPTIONS check
    r_options = client.options("/api/v1/search?q=Calpol", headers=headers)
    assert r_options.status_code == 200
    assert r_options.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert r_options.headers.get("access-control-allow-credentials") == "true"

    # Regular GET request check
    r_get = client.get("/api/v1/search?q=Calpol", headers={"Origin": "http://localhost:5173"})
    assert r_get.status_code == 200
    assert r_get.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_kendras_nearest_lucknow(client):
    """Test /api/v1/kendras/nearest returns closest Kendras with accurate distance."""
    response = client.get("/api/v1/kendras/nearest?lat=26.85&lng=80.95&limit=3")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["success"] is True
    assert json_data["disclaimer"] == STANDARD_DISCLAIMER
    _assert_no_forbidden_fields(json_data)

    kendras = json_data["data"]["kendras"]
    assert len(kendras) == 3
    # First Kendra in Hazratganj Lucknow should be ~0.0 km
    assert "Hazratganj" in kendras[0]["name"]
    assert kendras[0]["distance_km"] < 1.0
    assert "maps_url" in kendras[0]
    assert "lat" in kendras[0] and "lng" in kendras[0]


def test_kendras_invalid_coordinates(client):
    """Test 422 validation for latitude out of range."""
    response = client.get("/api/v1/kendras/nearest?lat=999&lng=80.95")
    assert response.status_code == 422
    assert response.json()["disclaimer"] == STANDARD_DISCLAIMER


def test_unified_healthz_and_readyz(client):
    """Test unified health and readiness endpoints mounted on the same application."""
    r_health = client.get("/healthz")
    assert r_health.status_code == 200
    assert r_health.json() == {"status": "ok"}

    r_ready = client.get("/readyz")
    assert r_ready.status_code == 200
    ready_data = r_ready.json()
    assert ready_data["status"] == "ready"
    assert ready_data["ocr"] in ("mock", "ok")
    assert ready_data["typing_path"] == "available"
    assert ready_data["data"]["brands"] is True
    assert ready_data["data"]["janaushadhi_products"] is True
    assert ready_data["data"]["kendras"] is True


def test_unified_prescription_candidates_and_summary(client):
    """Test prescription candidate scoring and summary on the single unified server."""
    # 1. Candidates scoring
    r_cand = client.post("/v1/prescription/candidates", json={"items": ["Dolo 650", "Calpol 500"]})
    assert r_cand.status_code == 200
    results = r_cand.json()["results"]
    assert len(results) == 2
    assert results[0]["tier"] in ("exact", "likely")
    assert len(results[0]["matches"]) >= 1

    # 2. Summary pricing calculation
    summary_payload = {
        "patient": {"age_years": 32, "gender": "male"},
        "confirmed_by_user": True,
        "items": [{"brand_id": "paracetamol-650mg-tab", "quantity_packs": 2}]
    }
    r_sum = client.post("/v1/prescription/summary", json=summary_payload)
    assert r_sum.status_code == 200
    sum_data = r_sum.json()
    assert sum_data["totals"]["compared_lines"] == 1
    assert sum_data["totals"]["difference_inr"] > 0
    assert "disclaimer" in sum_data




