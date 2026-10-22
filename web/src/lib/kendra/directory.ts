import { nearestKendras, type Kendra, type KendraHit } from "@/lib/kendra/nearest";

const DIRECTORY = "https://janaushadhi.gov.in:8443";
const USER_AGENT = "GenericBeforePay/1.0 (Jan Aushadhi Kendra distance)";

type OfficialRow = {
  storeCode?: string;
  contactNumber?: string | null;
  pinCode?: number | string;
  stateName?: string;
  districtName?: string;
  kendraAddress?: string;
  latitude?: string;
  longitude?: string;
};

type SearchBody = {
  responseCode?: number;
  responseBody?: { totalElement?: number; addKendraResponseList?: OfficialRow[] };
};

type StateRow = { stateCode?: number; stateNameInEnglish?: string };
type DistrictRow = { districtCode?: number; districtNameInEnglish?: string };

export type DirectoryStatus = "ok" | "empty" | "unavailable";

export type DirectoryResult = {
  status: DirectoryStatus;
  hits: KendraHit[];
};

type TokenCache = { value: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export function clearDirectoryCache(): void {
  tokenCache = null;
}

/** Keep rows that carry a published code, address, and coordinates. */
export function kendrasFromRows(rows: OfficialRow[]): Kendra[] {
  const out: Kendra[] = [];
  for (const row of rows) {
    const latText = String(row.latitude ?? "").trim();
    const lngText = String(row.longitude ?? "").trim();
    const lat = Number(latText);
    const lng = Number(lngText);
    const code = (row.storeCode ?? "").trim();
    const street = (row.kendraAddress ?? "").trim();
    if (!code || !street || latText === "" || lngText === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    const place = [street, row.districtName, row.stateName, row.pinCode].filter((part) => part !== undefined && String(part).trim() !== "").join(", ");
    out.push({
      id: code,
      name: `Jan Aushadhi Kendra ${code}`,
      address: place,
      phone: cleanPhone(row.contactNumber),
      lat,
      lng,
      updated: null,
    });
  }
  return out;
}

export async function lookupDirectory(
  input: { lat?: number; lng?: number; pin?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<DirectoryResult> {
  const pin = input.pin && /^\d{6}$/.test(input.pin) ? input.pin : undefined;
  const hasGps = Number.isFinite(input.lat) && Number.isFinite(input.lng);
  if (!pin && !hasGps) return { status: "empty", hits: [] };

  try {
    const token = await guestToken(fetchImpl);
    const rows: OfficialRow[] = [];
    let found = false;
    const origin = hasGps ? { lat: input.lat as number, lng: input.lng as number } : await pinOrigin(pin, fetchImpl);

    if (pin) {
      const page = await searchKendras(token, { stateId: 0, districtId: 0, pinCode: pin, pageSize: 40 }, fetchImpl);
      if (page) {
        found = true;
        rows.push(...page);
      }
    }

    if (hasGps) {
      const place = await reversePlace(input.lat as number, input.lng as number, fetchImpl);
      if (place.postcode && place.postcode !== pin) {
        const page = await searchKendras(token, { stateId: 0, districtId: 0, pinCode: place.postcode, pageSize: 40 }, fetchImpl);
        if (page) {
          found = true;
          rows.push(...page);
        }
      }
      if (place.state) {
        const stateId = await stateCode(place.state, token, fetchImpl);
        const districtId = stateId && place.district ? await districtCode(stateId, place.district, token, fetchImpl) : null;
        if (stateId && districtId) {
          const page = await searchKendras(token, { stateId, districtId, pinCode: 0, pageSize: 400 }, fetchImpl);
          if (page) {
            found = true;
            rows.push(...page);
          }
        }
      }
    }

    const kendras = dedupe(kendrasFromRows(rows));
    if (kendras.length === 0) return { status: found ? "empty" : "unavailable", hits: [] };
    if (!origin) return { status: "ok", hits: kendras.slice(0, 3).map((row) => ({ ...row, distanceKm: null })) };
    return { status: "ok", hits: nearestKendras(origin, kendras, 3) };
  } catch {
    return { status: "unavailable", hits: [] };
  }
}

function cleanPhone(value: string | null | undefined): string | null {
  const phone = (value ?? "").trim();
  if (!phone || phone.toLowerCase() === "null") return null;
  return phone;
}

function fold(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function dedupe(rows: Kendra[]): Kendra[] {
  const seen = new Set<string>();
  const out: Kendra[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

async function guestToken(fetchImpl: typeof fetch): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  const response = await fetchImpl(`${DIRECTORY}/auth/generateGuestToken`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("token");
  const body = (await response.json()) as { responseBody?: string };
  if (!body.responseBody) throw new Error("token");
  tokenCache = { value: body.responseBody, expiresAt: Date.now() + 20 * 60 * 1000 };
  return body.responseBody;
}

async function searchKendras(
  token: string,
  query: { stateId: number; districtId: number; pinCode: string | number; pageSize: number },
  fetchImpl: typeof fetch,
): Promise<OfficialRow[] | null> {
  try {
    const first = await searchPage(token, query, fetchImpl);
    if (!first) return null;
    if (first.total <= first.rows.length || first.rows.length >= 800) return first.rows;
    const second = await searchPage(token, { ...query, pageSize: Math.min(first.total, 800) }, fetchImpl);
    return second ? second.rows : first.rows;
  } catch {
    return null;
  }
}

async function searchPage(
  token: string,
  query: { stateId: number; districtId: number; pinCode: string | number; pageSize: number },
  fetchImpl: typeof fetch,
): Promise<{ rows: OfficialRow[]; total: number } | null> {
  const response = await fetchImpl(`${DIRECTORY}/api/v1/website/getAllKendraByStateDistrict`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pageIndex: 0,
      pageSize: query.pageSize,
      stateId: query.stateId,
      districtId: query.districtId,
      pinCode: query.pinCode,
      storeCode: "",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as SearchBody;
  if (body.responseCode !== 200) return null;
  const rows = body.responseBody?.addKendraResponseList ?? [];
  return { rows, total: body.responseBody?.totalElement ?? rows.length };
}

async function stateCode(name: string, token: string, fetchImpl: typeof fetch): Promise<number | null> {
  const response = await fetchImpl(`${DIRECTORY}/api/kendra/getAllStateOfIndia`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: StateRow[] };
  const wanted = fold(name);
  const row = (body.data ?? []).find((item) => fold(item.stateNameInEnglish ?? "") === wanted);
  return typeof row?.stateCode === "number" ? row.stateCode : null;
}

async function districtCode(stateId: number, name: string, token: string, fetchImpl: typeof fetch): Promise<number | null> {
  const response = await fetchImpl(`${DIRECTORY}/api/kendra/getDistrictByStateId?id=${stateId}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: DistrictRow[] };
  const wanted = fold(name);
  const row = (body.data ?? []).find((item) => fold(item.districtNameInEnglish ?? "") === wanted);
  return typeof row?.districtCode === "number" ? row.districtCode : null;
}

async function reversePlace(lat: number, lng: number, fetchImpl: typeof fetch): Promise<{ postcode?: string; state?: string; district?: string }> {
  try {
    const response = await fetchImpl(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&format=json`,
      { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) return {};
    const body = (await response.json()) as { address?: Record<string, string> };
    const address = body.address ?? {};
    const postcode = (address.postcode ?? "").replace(/\D/g, "");
    return {
      postcode: /^\d{6}$/.test(postcode) ? postcode : undefined,
      state: address.state,
      district: address.state_district || address.county || address.city_district || address.city,
    };
  } catch {
    return {};
  }
}

async function pinOrigin(pin: string | undefined, fetchImpl: typeof fetch): Promise<{ lat: number; lng: number } | null> {
  if (!pin) return null;
  try {
    const response = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?postalcode=${pin}&country=India&format=json&limit=1`,
      { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { lat?: string; lon?: string }[];
    const lat = Number(body[0]?.lat);
    const lng = Number(body[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
