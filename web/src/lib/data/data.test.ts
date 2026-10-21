import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DISCLAIMER, NOT_IN_DATA } from "@/lib/copy/approved";
import catalog from "@/data/catalog.json";
import { buildCatalogFile } from "@/lib/data/build";
import { medicineInfoText, toDisplayRecord } from "@/lib/data/display";
import { loadCatalog } from "@/lib/data/load";
import { parseUnit } from "@/lib/data/pack";
import { validateDrugList } from "@/lib/data/validate";

const sourcePath = path.resolve(import.meta.dirname, "../../../../data/curated_drugs.json");
const source: unknown = JSON.parse(readFileSync(sourcePath, "utf8"));

describe("curated drug data", () => {
  it("validates the repo seed and matches the Python content hash", () => {
    const built = buildCatalogFile(source, "production");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.file.records).toHaveLength(106);
    expect(built.file.provenance).toBe("production");
    expect(built.file.priceDate).toBeNull();
    expect(built.file.disclaimer).toBe(DISCLAIMER);
    expect(built.file.contentSha256).toBe("f421488089a72bc3bfa21e953929a37529c72fec89a7a68dff237ce7e6884b85");
    expect(catalog.contentSha256).toBe(built.file.contentSha256);
    expect(catalog.records).toHaveLength(106);
  });

  it("exposes source, a missing price date, pack fields, and no invented medicine info", () => {
    const built = buildCatalogFile(source);
    if (!built.ok) throw new Error("seed failed");
    const seed = built.file.records.find((record) => record.id === "paracetamol-500mg-tab");
    if (!seed) throw new Error("missing paracetamol-500mg-tab");
    const calpol = toDisplayRecord(seed, "fixture");
    expect(calpol.id).toBe("paracetamol-500mg-tab");
    expect(calpol.composition).toBe("Paracetamol");
    expect(calpol.strength).toBe("500 mg");
    expect(calpol.form).toBe("tablet");
    expect(calpol.packSize).toBe(10);
    expect(calpol.brandedPackPrice).toBe(32.5);
    expect(calpol.genericPackPrice).toBe(5);
    expect(calpol.brandedPerUnit).toBe(3.25);
    expect(calpol.genericPerUnit).toBe(0.5);
    expect(calpol.source).toBe("PMBJP Price List 2024 / NPPA");
    expect(calpol.priceDate).toBeNull();
    expect(calpol.provenance).toBe("fixture");
    expect(calpol.medicineInfo).toBeNull();
    expect(medicineInfoText(calpol)).toBe(NOT_IN_DATA);
  });

  it("leaves per-unit price empty when the unit string is ambiguous", () => {
    expect(parseUnit("box of strips")).toEqual({ packSize: null, form: null, perUnitLabel: null });
    expect(parseUnit("100 ml bottle")).toMatchObject({ packSize: 100, form: "bottle", perUnitLabel: "ml" });
  });

  it("rejects forbidden fields, bad prices, and duplicate ids", () => {
    const dosage = validateDrugList([{ dosage: "1 tab", id: "x" }]);
    expect(dosage.ok).toBe(false);
    const negative = validateDrugList([
      {
        id: "x",
        brand_name: "X",
        molecule: "Y",
        strength: "10 mg",
        unit: "strip of 10 tablets",
        branded_price: -1,
        generic_price: 1,
        source: "src",
      },
    ]);
    expect(negative.ok).toBe(false);
    const dup = validateDrugList([row("same"), row("same")]);
    expect(dup.ok).toBe(false);
  });

  it("degrades in production mode and throws in strict mode", () => {
    const bad = { provenance: "fixture", priceDate: null, disclaimer: DISCLAIMER, records: { nope: true } };
    const degraded = loadCatalog(bad, "degrade");
    expect(degraded.ok).toBe(false);
    if (!degraded.ok) expect(degraded.records).toEqual([]);
    expect(() => loadCatalog(bad, "strict")).toThrow();
  });
});

function row(id: string) {
  return {
    id,
    brand_name: "Example",
    molecule: "Example Molecule",
    strength: "10 mg",
    unit: "strip of 10 tablets",
    branded_price: 10,
    generic_price: 2,
    source: "fixture",
    aliases: [],
  };
}
