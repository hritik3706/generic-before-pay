import { describe, expect, it } from "vitest";
import { hasConfirmedLine, initialSession, sessionReducer } from "@/lib/session/reducer";
import { buildLine } from "@/lib/session/lines";
import { loadBundledCatalog } from "@/lib/data/load";

describe("sessionReducer", () => {
  it("starts empty of medicines and patient details", () => {
    expect(initialSession.started).toBe(false);
    expect(initialSession.lines).toEqual([]);
    expect(initialSession.patient.confirmed).toBe(false);
    expect(initialSession.ocr).toBeNull();
  });

  it("reset drops lines, patient details, and the started flag", () => {
    const catalog = loadBundledCatalog();
    if (!catalog.ok) throw new Error("catalog");
    const started = sessionReducer(initialSession, { type: "addLine", line: buildLine("Calpol 500", catalog.records, "a") });
    expect(started.started).toBe(true);
    expect(sessionReducer(started, { type: "reset" })).toEqual(initialSession);
  });

  it("replaces the medicine list when a new prescription is read", () => {
    const catalog = loadBundledCatalog();
    if (!catalog.ok) throw new Error("catalog");
    const started = sessionReducer(initialSession, { type: "addLine", line: buildLine("Calpol 500", catalog.records, "a") });
    const next = sessionReducer(started, { type: "setLines", lines: [buildLine("Azithral 500", catalog.records, "b")] });
    expect(next.lines.map((line) => line.query)).toEqual(["Azithral 500"]);
  });

  it("does not count an unconfirmed line", () => {
    const catalog = loadBundledCatalog();
    if (!catalog.ok) throw new Error("catalog");
    const line = buildLine("Calpol 500", catalog.records, "a");
    const started = sessionReducer(initialSession, { type: "addLine", line });
    expect(hasConfirmedLine(started)).toBe(false);
    const confirmed = sessionReducer(started, { type: "confirmLine", key: "a", selectedId: line.selectedId ?? "" });
    expect(hasConfirmedLine(confirmed)).toBe(true);
  });
});
