import type { DisplayRecord } from "@/lib/data/types";
import { similarityScore } from "@/lib/matching/distance";
import { normalizeName, parseStrength } from "@/lib/matching/strength";
import { SCORE_LIKELY_AT } from "@/lib/matching/thresholds";

const MAX_NAMES = 12;

type Label = {
  id: string;
  brandName: string;
  stem: string;
  span: number;
  strengths: number[];
};

type Found = {
  span: number;
  rows: Label[];
  strengthToken: boolean;
};

/** Read listed brand names out of printed text, including a one-letter misread. */
export function catalogNamesInText(text: string, records: DisplayRecord[]): string[] {
  const words = normalizeName(text).split(" ").filter(Boolean);
  const labels = labelsFor(records);
  const names: string[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (index < words.length && names.length < MAX_NAMES) {
    const found = bestMatch(words, index, labels);
    if (!found) {
      index += 1;
      continue;
    }
    const query = chooseQuery(words, index, found);
    const key = query.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      names.push(query);
    }
    index += found.span + (found.strengthToken ? 1 : 0);
    if (words[index] === "mg" || words[index] === "ml") index += 1;
  }
  return names;
}

export function samePrintedMedicine(listedName: string, line: string): boolean {
  const listed = parseStrength(listedName).name;
  const printed = parseStrength(line).name;
  if (!listed || !printed) return false;
  return printed === listed || printed.startsWith(`${listed} `) || listed.startsWith(`${printed} `);
}

function labelsFor(records: DisplayRecord[]): Label[] {
  const labels: Label[] = [];
  for (const record of records) {
    const strengths = strengthValues(record);
    const seenStems = new Set<string>();
    for (const source of [record.brandName, ...record.aliases]) {
      const stem = parseStrength(source).name;
      const compact = stem.replace(/ /g, "");
      if (compact.length < 3 || seenStems.has(stem)) continue;
      seenStems.add(stem);
      labels.push({
        id: record.id,
        brandName: record.brandName,
        stem,
        span: stem.split(" ").length,
        strengths,
      });
    }
  }
  return labels;
}

function strengthValues(record: DisplayRecord): number[] {
  const values = [...parseStrength(record.strength).parts, ...parseStrength(record.brandName).parts].map((part) => part.value);
  return [...new Set(values)];
}

function bestMatch(words: string[], index: number, labels: Label[]): Found | null {
  let bestScore = 0;
  let bestSpan = 0;
  for (const label of labels) {
    if (index + label.span > words.length) continue;
    const window = words.slice(index, index + label.span).join(" ");
    const score = similarityScore(window, label.stem);
    const compact = label.stem.replace(/ /g, "").length;
    const accept = score === 100 ? compact >= 3 : score >= SCORE_LIKELY_AT && compact >= 5;
    if (!accept) continue;
    if (score > bestScore || (score === bestScore && label.span > bestSpan)) {
      bestScore = score;
      bestSpan = label.span;
    }
  }
  if (bestScore === 0) return null;
  const window = words.slice(index, index + bestSpan).join(" ");
  const tied = labels.filter((label) => label.span === bestSpan && similarityScore(window, label.stem) === bestScore);
  const winner = [...tied].sort((a, b) => b.stem.length - a.stem.length || a.brandName.localeCompare(b.brandName))[0];
  if (!winner) return null;
  const rows = tied.filter((label) => label.stem === winner.stem);
  if (rows.length === 0) return null;
  const next = words[index + bestSpan] ?? "";
  const number = /^\d+(?:\.\d+)?$/.test(next) ? Number(next) : null;
  const strengthToken = number !== null && rows.some((row) => row.strengths.includes(number));
  return { span: bestSpan, rows, strengthToken };
}

function chooseQuery(words: string[], index: number, found: Found): string {
  const next = words[index + found.span] ?? "";
  const number = /^\d+(?:\.\d+)?$/.test(next) ? Number(next) : null;
  const byStrength = number === null ? [] : found.rows.filter((row) => row.strengths.includes(number));
  if (byStrength.length === 1) return byStrength[0]!.brandName;
  const ids = new Set(found.rows.map((row) => row.id));
  if (ids.size === 1) return found.rows[0]!.brandName;
  return stemLabel(found.rows[0]!.brandName);
}

function stemLabel(brandName: string): string {
  const stripped = brandName
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/\b(?:mg|ml|mcg|iu|g)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || brandName;
}
