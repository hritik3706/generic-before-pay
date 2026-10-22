import { describe, expect, it } from "vitest";
import { clearDirectoryCache, kendrasFromRows, lookupDirectory } from "@/lib/kendra/directory";

const ROW = {
  storeCode: "PMBJK00455",
  contactNumber: "7011186286",
  pinCode: 110001,
  stateName: "Delhi",
  districtName: "Central",
  kendraAddress: "Garage No. 29, Shastri Bhawan",
  latitude: "28.6164875",
  longitude: "77.2166719",
};

describe("kendra directory", () => {
  it("keeps a published Kendra and drops a row without coordinates", () => {
    const rows = kendrasFromRows([ROW, { ...ROW, storeCode: "PMBJK00000", latitude: "", longitude: "" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "PMBJK00455",
      name: "Jan Aushadhi Kendra PMBJK00455",
      phone: "7011186286",
      lat: 28.6164875,
      lng: 77.2166719,
    });
  });

  it("returns the nearest published Kendra for a PIN", async () => {
    clearDirectoryCache();
    const result = await lookupDirectory({ pin: "110001" }, async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/generateGuestToken")) {
        return json({ responseBody: "guest-token" });
      }
      if (url.includes("postalcode=110001")) {
        return json([{ lat: "28.63", lon: "77.22" }]);
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { pinCode?: string };
      expect(body.pinCode).toBe("110001");
      return json({
        responseCode: 200,
        responseBody: {
          totalElement: 2,
          addKendraResponseList: [
            ROW,
            { ...ROW, storeCode: "PMBJK00999", latitude: "28.90", longitude: "77.20", kendraAddress: "Far road" },
          ],
        },
      });
    });

    expect(result.status).toBe("ok");
    expect(result.hits[0]?.id).toBe("PMBJK00455");
    expect(result.hits[0]?.distanceKm ?? 0).toBeLessThan(result.hits[1]?.distanceKm ?? 0);
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
