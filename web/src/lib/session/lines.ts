import type { DisplayRecord } from "@/lib/data/types";
import { matchQuery } from "@/lib/matching/match";
import { medicineNamesFromPrintedText } from "@/lib/ocr/candidates";
import { catalogNamesInText } from "@/lib/ocr/printed";
import type { RxLine } from "@/lib/session/reducer";

let sequence = 0;

export function newLineKey(): string {
  sequence += 1;
  return `line-${sequence}`;
}

export function buildLine(query: string, records: DisplayRecord[], key = newLineKey()): RxLine {
  const result = matchQuery(query, records);
  const only = result.matches.length === 1 ? result.matches[0] : undefined;
  const selectedId = (result.tier === "exact" || result.tier === "likely") && only ? only.id : null;
  return {
    key,
    query: query.trim(),
    tier: result.tier,
    reason: result.reason,
    candidateIds: result.matches.map((match) => match.id),
    selectedId,
    confirmed: false,
    quantity: 1,
  };
}

export function linesFromOcr(text: string, candidates: string[], records: DisplayRecord[]): RxLine[] {
  const source = [text, ...candidates].join("\n");
  const printed = medicineNamesFromPrintedText(source);
  const listed = printed.length > 0 ? [] : catalogNamesInText(source, records);
  const names: string[] = [];
  for (const name of [...printed, ...listed]) {
    if (names.some((kept) => kept.toLowerCase() === name.toLowerCase())) continue;
    names.push(name);
  }
  return names.slice(0, 12).map((name) => buildLine(name, records));
}
