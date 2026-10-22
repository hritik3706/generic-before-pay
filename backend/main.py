"""
backend/main.py

FastAPI application for Generic Before Pay.
Provides REST endpoints:
- GET  /api/v1/search
- GET  /api/v1/drugs/{id}
- POST /api/v1/compare
- GET  /api/v1/data/version
- GET  /api/v1/data/bundle

Strict safety rules:
- Disclaimer in every response.
- No medical dosage, frequency, or substitution advice.
- Structured logs for search queries and not-found cases.
"""

import json
import logging
import hashlib
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from backend.database import init_db, DEFAULT_SEED_PATH
from backend.dal import (
    get_drug_by_id,
    get_all_drugs,
    search_drugs,
    get_dataset_metadata,
    calculate_compare,
    STANDARD_DISCLAIMER
)
import math
from backend.schemas import (
    SearchResponse,
    SearchData,
    SearchMatchItem,
    DrugDetailResponse,
    DrugDetailData,
    CompareRequest,
    CompareResponse,
    CompareData,
    DataVersionResponse,
    DataVersionData,
    DataBundleResponse,
    DataBundleMetadata,
    ErrorResponse,
    KendraResponse,
    KendraData,
    KendraItem
)

# JanRx Unified Modules
from janrx.backend.app.config import get_settings as get_janrx_settings
from janrx.backend.app.datastore import DataStore
from janrx.backend.app.metrics import Metrics
from janrx.backend.app.ratelimit import SlidingWindowLimiter
from janrx.backend.app.ocr.service import build_provider
from janrx.backend.app.errors import ApiError, envelope as janrx_envelope
from janrx.backend.app.routers import health as janrx_health
from janrx.backend.app.routers import ocr as janrx_ocr
from janrx.backend.app.routers import prescription as janrx_prescription
from janrx.backend.app.routers import kendras as janrx_kendras
from janrx.backend.app.routers import metrics as janrx_metrics

# Setup structured logger
logger = logging.getLogger("generic_before_pay")
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    formatter = logging.Formatter(
        '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": %(message)s}'
    )
    ch.setFormatter(formatter)
    logger.addHandler(ch)


def _log_event(event_type: str, **kwargs):
    payload = {"event": event_type, **kwargs}
    logger.info(json.dumps(payload))


def compute_dataset_hash() -> str:
    if DEFAULT_SEED_PATH.exists():
        with open(DEFAULT_SEED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        canonical_json = json.dumps(data, sort_keys=True, separators=(',', ':')).encode('utf-8')
        return hashlib.sha256(canonical_json).hexdigest()
    return "unknown"


DATASET_HASH = compute_dataset_hash()
DATASET_VERSION = "2026.10.1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB on startup
    init_db()
    _log_event("app_startup", version=DATASET_VERSION, dataset_hash=DATASET_HASH)
    yield


app = FastAPI(
    title="Generic Before Pay API",
    description="Cost-transparency, generic medicine alternatives lookup, and prescription OCR.",
    version="1.0.0",
    lifespan=lifespan
)

# Initialize JanRx Unified State (OCR provider, data store, rate limiter, metrics)
janrx_settings = get_janrx_settings()
app.state.settings = janrx_settings
app.state.metrics = Metrics()
app.state.limiter = SlidingWindowLimiter(janrx_settings.ocr_rate_limit_per_minute, 60)
app.state.ocr_provider = build_provider(janrx_settings)
app.state.data = DataStore(janrx_settings.data_dir)

FRONTEND_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # React / Next.js
    "http://localhost:8080",  # Vue / Flutter web
    "http://localhost:8081",  # React Native / Expo
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return janrx_envelope(exc.status_code, exc.code, exc.message, exc.fallback, exc.headers)


# Global validation error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload",
                "details": exc.errors()
            },
            "disclaimer": STANDARD_DISCLAIMER
        }
    )


# Global HTTP exception handler
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "RESOURCE_NOT_FOUND" if exc.status_code == 404 else "CLIENT_ERROR"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": exc.detail,
                "details": None
            },
            "disclaimer": STANDARD_DISCLAIMER
        }
    )


from fastapi import APIRouter

api_router = APIRouter()


@api_router.get("/search", response_model=SearchResponse)
def search_drugs_endpoint(
    q: str = Query(..., min_length=1, description="Drug brand name, partial name, or molecule"),
    limit: int = Query(3, ge=1, le=10, description="Max matches to return (default 3)")
):
    query_str = q.strip()
    matches = search_drugs(query=query_str, limit=limit)

    _log_event(
        "search_query",
        query=query_str,
        results_count=len(matches),
        top_match=matches[0]["brand_name"] if matches else None,
        top_confidence=matches[0]["confidence_score"] if matches else 0.0
    )

    if not matches:
        _log_event("search_not_found", query=query_str)

    match_items = [SearchMatchItem(**m) for m in matches]
    return SearchResponse(
        success=True,
        data=SearchData(
            query=query_str,
            total_matches=len(match_items),
            matches=match_items
        ),
        disclaimer=STANDARD_DISCLAIMER
    )


@api_router.get("/drugs/{id}", response_model=DrugDetailResponse)
def get_drug_detail_endpoint(id: str):
    drug = get_drug_by_id(id)
    if not drug:
        _log_event("drug_detail_not_found", requested_id=id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Drug with id '{id}' was not found."
        )

    return DrugDetailResponse(
        success=True,
        data=DrugDetailData(**drug),
        disclaimer=STANDARD_DISCLAIMER
    )


@api_router.post("/compare", response_model=CompareResponse)
def compare_drugs_endpoint(payload: CompareRequest):
    items = []
    if payload.items:
        items.extend([{"id": it.id, "quantity": it.quantity} for it in payload.items])
    if payload.ids:
        items.extend([{"id": d_id, "quantity": 1} for d_id in payload.ids])

    result = calculate_compare(items)
    
    _log_event(
        "compare_basket",
        item_count=len(result["breakdown"]),
        total_savings=result["summary"]["total_savings"],
        skipped_count=len(result["summary"]["skipped_ids"])
    )

    return CompareResponse(
        success=True,
        data=CompareData(
            summary=result["summary"],
            breakdown=result["breakdown"]
        ),
        disclaimer=STANDARD_DISCLAIMER
    )


@api_router.get("/data/version", response_model=DataVersionResponse)
def get_data_version_endpoint():
    meta = get_dataset_metadata()
    dataset_hash = meta.get("dataset_hash", DATASET_HASH)
    dataset_version = f"v1.{dataset_hash[:8]}"
    return DataVersionResponse(
        success=True,
        data=DataVersionData(
            schema_version="1.0.0",
            dataset_version=dataset_version,
            dataset_hash=dataset_hash,
            total_records=int(meta.get("total_records", 0))
        )
    )


@api_router.get("/data/bundle", response_model=DataBundleResponse)
def get_data_bundle_endpoint(request: Request, response: Response):
    meta = get_dataset_metadata()
    dataset_hash = meta.get("dataset_hash", DATASET_HASH)
    dataset_version = f"v1.{dataset_hash[:8]}"

    client_etag = request.headers.get("if-none-match")
    if client_etag and client_etag.strip('"') == dataset_hash:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={
                "ETag": f'"{dataset_hash}"',
                "Cache-Control": "public, max-age=3600"
            }
        )

    response.headers["ETag"] = f'"{dataset_hash}"'
    response.headers["Cache-Control"] = "public, max-age=3600"
    all_drugs = get_all_drugs()

    return DataBundleResponse(
        success=True,
        metadata=DataBundleMetadata(
            version=dataset_version,
            dataset_hash=dataset_hash,
            record_count=len(all_drugs)
        ),
        drugs=[DrugDetailData(**d) for d in all_drugs],
        disclaimer=STANDARD_DISCLAIMER
    )


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat, dlng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(a))


_KENDRA_CACHE = None


def get_all_kendras():
    global _KENDRA_CACHE
    if _KENDRA_CACHE is None:
        kendras_path = Path(__file__).resolve().parent.parent / "data" / "kendras.json"
        if not kendras_path.is_file():
            kendras_path = Path(__file__).resolve().parent.parent / "janrx" / "data" / "kendras.json"
        if kendras_path.is_file():
            with open(kendras_path, "r", encoding="utf-8") as f:
                _KENDRA_CACHE = json.load(f)
        else:
            _KENDRA_CACHE = []
    return _KENDRA_CACHE


@api_router.get(
    "/kendras/nearest",
    response_model=KendraResponse,
    summary="Find Nearest Jan Aushadhi Kendras",
    description="Calculates haversine distance to nearest PMBJP stores from user coordinates."
)
async def get_nearest_kendras(
    lat: float = Query(..., ge=-90, le=90, description="User latitude"),
    lng: float = Query(..., ge=-180, le=180, description="User longitude"),
    limit: int = Query(3, ge=1, le=10, description="Maximum number of stores to return")
):
    kendras = get_all_kendras()
    if not kendras:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kendras database is currently unavailable."
        )

    ranked = sorted(kendras, key=lambda k: haversine_km(lat, lng, k["lat"], k["lng"]))[:limit]
    kendra_items = [
        KendraItem(
            **k,
            distance_km=round(haversine_km(lat, lng, k["lat"], k["lng"]), 1),
            maps_url=f"https://www.google.com/maps/search/?api=1&query={k['lat']},{k['lng']}"
        )
        for k in ranked
    ]

    return KendraResponse(
        success=True,
        data=KendraData(
            total_kendras=len(kendra_items),
            kendras=kendra_items,
            note="Please call ahead; stock may vary."
        ),
        disclaimer=STANDARD_DISCLAIMER
    )


# Register core drug & compare routes under both /api/v1 (canonical) and /api (convenience fallback)
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api")

# Register JanRx Unified Routes:
# 1. OCR service (/v1/ocr & /api/v1/ocr)
# 2. Prescription verification (/v1/prescription/candidates, /v1/prescription/summary & /api/v1/...)
# 3. Health & Readiness checks (/healthz, /readyz & /api/v1/healthz, /api/v1/readyz)
# 4. Metrics (/v1/metrics & /api/v1/metrics)
app.include_router(janrx_health.router)
app.include_router(janrx_ocr.router)
app.include_router(janrx_prescription.router)
app.include_router(janrx_metrics.router)

# Also expose under /api prefix for unified client compatibility
app.include_router(janrx_ocr.router, prefix="/api")
app.include_router(janrx_prescription.router, prefix="/api")
app.include_router(janrx_health.router, prefix="/api/v1")
app.include_router(janrx_metrics.router, prefix="/api")
