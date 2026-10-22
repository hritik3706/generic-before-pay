import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalogFile } from "@/lib/data/build";
import { toDisplayRecord } from "@/lib/data/display";
import type { DisplayRecord } from "@/lib/data/types";
import { catalogNamesInText } from "@/lib/ocr/printed";
import { linesFromOcr } from "@/lib/session/lines";

const sourcePath = path.resolve(import.meta.dirname, "../../../../data/curated_drugs.json");
const source: unknown = JSON.parse(readFileSync(sourcePath, "utf8"));
const built = buildCatalogFile(source);
if (!built.ok) throw new Error(built.problems.join("\n"));
const records: DisplayRecord[] = built.file.records.map((record) => toDisplayRecord(record, "fixture"));

describe("catalogNamesInText", () => {
  it("reads a printed brand even when a letter is wrong or a variant follows", () => {
    expect(catalogNamesInText("Evion LC Tablet", records)).toEqual(["Evion 400"]);
    expect(catalogNamesInText("Azlthral 500 OD", records)).toEqual(["Azithral 500"]);
    expect(catalogNamesInText("Telma 40", records)).toEqual(["Telma 40"]);
    expect(catalogNamesInText("Telma", records)).toEqual(["Telma"]);
  });

  it("ignores the symptom and diagnosis lines", () => {
    const text = [
      "activity",
      "ungeon SYMPTOMS : Pain B/L Heel Maximum at rest releived by activity",
      "DIAGNOSIS : Planter fascitis B/L H/O Stroke year back",
      "Evion LC Tablet",
    ].join("\n");
    expect(catalogNamesInText(text, records)).toEqual(["Evion 400"]);
  });

  it("keeps each printed medicine instead of only the one brand in the price list", () => {
    const text = [
      "Evion LC Tablet",
      "Dailyshine 60K Tablet",
      "Cyra-D Capsule",
      "Anprox-MR Tablet",
      "Ultranise 37.5mg/325mg Tablet",
    ].join("\n");
    const lines = linesFromOcr(text, [], records);
    expect(lines.map((line) => line.query)).toEqual([
      "Evion LC Tablet",
      "Dailyshine 60K Tablet",
      "Cyra-D Capsule",
      "Anprox-MR Tablet",
      "Ultranise 37.5mg/325mg Tablet",
    ]);
  });

  it("drops a misread that is not a listed medicine", () => {
    const lines = linesFromOcr("Mv: © hdedop Oh\n9 Sdogupte [lud infake\nPR ~ Eos", ["Mv: © hdedop Oh"], records);
    expect(lines).toEqual([]);
  });
});