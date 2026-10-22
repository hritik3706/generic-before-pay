export type LatLng = { lat: number; lng: number };

export type Kendra = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  updated: string | null;
};

export type KendraHit = Kendra & { distanceKm: number | null };

const EARTH_KM = 6371;

export function haversineKm(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestKendras(origin: LatLng, rows: Kendra[], limit = 3): KendraHit[] {
  return rows
    .map((row) => ({ ...row, distanceKm: haversineKm(origin, row) }))
    .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type PinRow = { pin: string; lat: number; lng: number };

export function lookupPin(pin: string, table: readonly PinRow[]): PinRow | "invalid" | "missing" {
  const cleaned = pin.trim();
  if (!/^\d{6}$/.test(cleaned)) return "invalid";
  return table.find((row) => row.pin === cleaned) ?? "missing";
}

export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

/** No Kendra rows are shipped in the bundle. Nearby rows are read from the public directory at request time. */
export const BUNDLED_KENDRAS: Kendra[] = [];
export const BUNDLED_PINS: PinRow[] = [];
