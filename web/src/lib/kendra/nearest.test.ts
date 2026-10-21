import { describe, expect, it } from "vitest";
import { haversineKm, lookupPin, mapsSearchUrl, nearestKendras, type Kendra } from "@/lib/kendra/nearest";

const ROWS: Kendra[] = [
  { id: "a", name: "North", address: "1 North Road", phone: "111", lat: 28.7, lng: 77.2, updated: null },
  { id: "b", name: "South", address: "2 South Road", phone: null, lat: 28.4, lng: 77.2, updated: "2024-01-01" },
  { id: "c", name: "East", address: "3 East Road", phone: "333", lat: 28.61, lng: 77.4, updated: null },
  { id: "d", name: "Far", address: "4 Far Road", phone: null, lat: 19.07, lng: 72.87, updated: null },
];

describe("kendra distance", () => {
  it("returns the nearest three and rejects a bad PIN", () => {
    const origin = { lat: 28.6139, lng: 77.209 };
    const hits = nearestKendras(origin, ROWS, 3);
    expect(hits).toHaveLength(3);
    expect(hits.map((hit) => hit.id)).not.toContain("d");
    expect(hits[0]!.distanceKm ?? 0).toBeLessThan(hits[1]!.distanceKm ?? 0);
    expect(haversineKm(origin, origin)).toBe(0);
    expect(lookupPin("110001", [])).toBe("missing");
    expect(lookupPin("abc", [])).toBe("invalid");
    expect(mapsSearchUrl("Jan Aushadhi")).toContain("query=Jan%20Aushadhi");
    expect(mapsSearchUrl("Jan Aushadhi")).not.toContain("key=");
  });
});
