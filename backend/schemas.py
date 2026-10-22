"""
backend/schemas.py

Pydantic models for Generic Before Pay REST API.
Enforces safety rules:
- Prohibits dosage, frequency, and substitution advice.
- Guarantees standard disclaimer presence on every response.
- Defines unified error responses.
"""

from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict
from backend.dal import STANDARD_DISCLAIMER


class SearchMatchItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    brand_name: str
    molecule: str
    strength: str
    unit: str
    branded_price: float
    generic_price: float
    savings_amount: float
    savings_percentage: float
    confidence_score: float
    match_type: str


class SearchData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    total_matches: int
    matches: List[SearchMatchItem]


class SearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    data: SearchData
    disclaimer: str = STANDARD_DISCLAIMER


class DrugDetailData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    brand_name: str
    molecule: str
    strength: str
    unit: str
    branded_price: float
    generic_price: float
    savings_amount: float
    savings_percentage: float
    source: str
    aliases: List[str] = Field(default_factory=list)


class DrugDetailResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    data: DrugDetailData
    disclaimer: str = STANDARD_DISCLAIMER


class CompareItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    quantity: int = Field(default=1, ge=1)


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: Optional[List[CompareItemRequest]] = Field(default_factory=list)
    ids: Optional[List[str]] = Field(default=None)


class CompareSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_items: int
    total_units: int
    total_branded_cost: float
    total_generic_cost: float
    total_savings: float
    overall_savings_percentage: float
    currency: str = "INR"
    skipped_ids: List[str] = Field(default_factory=list)


class CompareBreakdownItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    brand_name: str
    molecule: str
    strength: str
    unit: str
    quantity: int
    branded_unit_price: float
    generic_unit_price: float
    branded_total_price: float
    generic_total_price: float
    item_savings: float
    savings_percentage: float


class CompareData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: CompareSummary
    breakdown: List[CompareBreakdownItem]


class CompareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    data: CompareData
    disclaimer: str = STANDARD_DISCLAIMER


class DataVersionData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: str = "1.0.0"
    dataset_version: str
    dataset_hash: str
    total_records: int


class DataVersionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    data: DataVersionData


class DataBundleMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str
    dataset_hash: str
    record_count: int


class DataBundleResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    metadata: DataBundleMetadata
    drugs: List[DrugDetailData]
    disclaimer: str = STANDARD_DISCLAIMER


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = False
    error: ErrorDetail
    disclaimer: str = STANDARD_DISCLAIMER


class KendraItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kendra_code: Optional[str] = None
    name: str
    address: Optional[str] = None
    pincode: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    phone: Optional[str] = None
    lat: float
    lng: float
    distance_km: float
    maps_url: str
    data_date: Optional[str] = None


class KendraData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_kendras: int
    kendras: List[KendraItem]
    note: str = "Please call ahead; stock may vary."


class KendraResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    data: KendraData
    disclaimer: str = STANDARD_DISCLAIMER

