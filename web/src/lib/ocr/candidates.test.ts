import { describe, expect, it } from "vitest";
import { candidatesFromOcrText, medicineNamesFromPrintedText } from "@/lib/ocr/candidates";

describe("candidatesFromOcrText", () => {
  it("keeps medicine lines and drops the prescription header", () => {
    const text = [
      "Dr Sharma",
      "Date: 21/10/2026",
      "Rx",
      "1. Tab Calpol 500 mg 1-0-1 x 5 days",
      "2. Cap Azithral 500 OD",
      "3. Glycomet 500 1-0-1 after food",
      "Patient name",
    ].join("\n");

    expect(candidatesFromOcrText(text)).toEqual(["Calpol 500 mg", "Azithral 500", "Glycomet 500"]);
  });

  it("does not invent a name that was not printed", () => {
    expect(candidatesFromOcrText("Hospital\nSignature")).toEqual([]);
  });

  it("keeps every medicine in a printed prescription table", () => {
    const text = [
      "DIAGNOSIS : Planter fascitis B/L H/O stroke x 1 year back",
      "PRESCRIPTION",
      "Medications Dose Frequency Duration Remarks",
      "Evion LC Tablet (tablet)",
      "Levo-carnitine (150mg) + Vitamin E (200mg)",
      "1 tablet",
      "1-0-0 After Meal",
      "Dailyshine 60K Tablet (tablet)",
      "Cyra-D Capsule (capsule)",
      "Domperidone (30mg) + Rabeprazole (20mg)",
      "1 capsule",
      "Anprox-MR Tablet (tablet)",
      "Aceclofenac (100mg) + Paracetamol (325mg) + Tizanidine (2mg)",
      "Ultranise",
      "37.5mg/325mg",
      "Tablet (tablet)",
      "Tramadol (37.5mg) + Paracetamol (325mg)",
      "IN PAIN",
    ].join("\n");

    expect(medicineNamesFromPrintedText(text)).toEqual([
      "Evion LC Tablet",
      "Dailyshine 60K Tablet",
      "Cyra-D Capsule",
      "Anprox-MR Tablet",
      "Ultranise 37.5mg/325mg Tablet",
    ]);
  });

  it("drops the diagnosis tail and dose columns that sit beside the brand", () => {
    const text = [
      "H/O Stroke x1 year back Evion LC Tablet",
      "Dailyshine 60K twice a week After breakfast 4 Weeks Tablet",
      "Cyra-D Capsule",
      "i Anprox-MR Tablet",
      "Ultranise 37.5mg/325mg SOS After Meal Days Tablet",
    ].join(" ");

    expect(medicineNamesFromPrintedText(text)).toEqual([
      "Evion LC Tablet",
      "Dailyshine 60K Tablet",
      "Cyra-D Capsule",
      "Anprox-MR Tablet",
      "Ultranise 37.5mg/325mg Tablet",
    ]);
  });

  it("keeps the medicine and drops symptoms and the diagnosis", () => {
    const text = [
      "activity",
      "ungeon SYMPTOMS : Pain B/L Heel Maximum at rest releived by activity",
      "DIAGNOSIS : Planter fascitis B/L H/O Stroke year back",
      "Evion LC Tablet",
    ].join("\n");

    expect(candidatesFromOcrText(text)).toEqual(["Evion LC"]);
  });
});
