import type { DisplayRecord } from "@/lib/data/types";
import { matchQuery } from "@/lib/matching/match";
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

const FORM = /(?:tablets?|capsules?|syrups?|injections?|ointments?|suspensions?|sachets?|respules?|\b(?:caps?|tabs?|inj|cream|drops|gel)\b)/i;
const STRENGTH_UNIT = /\d+(?:\.\d+)?\s*(?:m\s*g|mcg|iu|ml|%)\b/i;
const STRENGTH_GLUED = /\d+(?:\.\d+)?(?:mg|mcg|iu|ml)\b/i;
const VITAMIN_K = /\b\d+\s*k\b/i;
const BRAND_STRENGTH = /[A-Za-z]{3,}[\s-]*\d{2,4}\b/;
const MONTH_OR_YEAR = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:19|20)\d{2}\b/i;
const PHONE = /(?:\+\d|\b\d[\d\s-]{8,}\d)/;
const DATE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
const CLOCK = /\b\d{1,2}:\d{2}\b/;
const DOSE_ONLY = /^\d+\s*(?:tablets?|capsules?|caps?|tabs?)$/i;
const DURATION_ONLY = /^\d+\s*(?:days?|weeks?|months?)$/i;
const DURATION_GLUED = /^\d+(?:days?|weeks?|months?)$/i;
const SCHEDULE_ONLY = /^[\d(]\s*[-–]\s*\d(?:\s*[-–]\s*\d)?$/;
const JUNK = /^(?:empty|days?|weeks?|months?|sos|breakfast|duration|dose|frequency|remarks|medications?|prescription|advice|symptoms?|diagnosis|follow-?up|in\s*pain|stomach|after|week)$/i;
const INSTRUCTIONS = /\b(?:after\s*meals?|empty\s*stomach|after\s*breakfast|twice\s*a\s*week|at\s*rest|before\s*meals?)\b/i;
const PAPERWORK = /\b(?:clinic|surgeon|hospital|doctor|symptoms?|diagnosis|prescription|advice|follow-?up|medications|remarks|female|male|years?|yrs|exercises?|insole)\b/i;

type LineKind = "skip" | "form" | "strength" | "fragment" | "medicine";

function hasMedicineSignal(line: string): boolean {
  if (DOSE_ONLY.test(line) || isFormOnly(line)) return false;
  if (FORM.test(line)) return true;
  if (STRENGTH_UNIT.test(line) || STRENGTH_GLUED.test(line) || VITAMIN_K.test(line)) return true;
  if (BRAND_STRENGTH.test(line) && !MONTH_OR_YEAR.test(line)) return true;
  if (/[A-Za-z]{5,}[^()\n]{0,20}\([^)]*\d/.test(line)) return true;
  if (/[A-Za-z]{8,}/.test(line) && /\(/.test(line)) return true;
  return false;
}

function isFormOnly(line: string): boolean {
  const core = line.replace(/[^A-Za-z]/g, "");
  return /^(?:tablets?|capsules?|caps?|tabs?)(?:tablets?|capsules?)?$/i.test(core);
}

function isStrengthOnly(line: string): boolean {
  const core = line.replace(/\s/g, "");
  return /^\d+(?:\.\d+)?(?:mg|mcg|iu|ml)(?:\/\d+(?:\.\d+)?(?:mg|mcg|iu|ml)?)?$/i.test(core);
}

function catalogMedicine(line: string, records: DisplayRecord[]): boolean {
  const result = matchQuery(line, records);
  if (result.tier === "exact" || result.tier === "likely") return true;
  return result.tier === "uncertain" && result.reason === "strength_needed";
}

function classify(line: string, records: DisplayRecord[]): LineKind {
  if (PHONE.test(line) || DATE.test(line)) return "skip";
  if (CLOCK.test(line) && !hasMedicineSignal(line)) return "skip";
  if (DOSE_ONLY.test(line) || DURATION_ONLY.test(line) || DURATION_GLUED.test(line) || SCHEDULE_ONLY.test(line)) return "skip";
  if (JUNK.test(line)) return "skip";
  if (isFormOnly(line)) return "form";
  if (isStrengthOnly(line)) return "strength";
  if (/^[+g)/0-9]/i.test(line) && /[A-Za-z]{4,}/.test(line)) return "fragment";
  if ((INSTRUCTIONS.test(line) || PAPERWORK.test(line) || MONTH_OR_YEAR.test(line)) && !hasMedicineSignal(line)) return "skip";
  if (hasMedicineSignal(line) || catalogMedicine(line, records)) return "medicine";
  if (/^[A-Z][a-z]{5,}$/.test(line)) return "medicine";
  return "skip";
}

function formWord(line: string): string {
  const match = /capsule|tablet|syrup|injection|cream|drops/i.exec(line);
  if (!match) return "";
  const word = match[0].toLowerCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function tidy(value: string): string {
  let name = value.replace(/\s+/g, " ").trim();
  name = name.replace(/io+mg/gi, "100mg");
  name = name.replace(/(\d+(?:\.\d+)?)m(?!g)\b/gi, "$1mg");
  name = name.replace(/mg\s*\d\)\+\s*/gi, "mg) + ");
  name = name.replace(/mg\s*g\)\+\s*/gi, "mg) + ");
  name = name.replace(/\+(?=[A-Za-z])/g, "+ ");
  name = name.replace(/([A-Za-z])(Tablet|Capsule|Syrup|Injection)/g, "$1 $2");
  name = name.replace(/\(\s*/g, " (").replace(/\s*\)/g, ")").replace(/\s{2,}/g, " ").replace(/\+\s*$/g, "").trim();
  const opened = name.match(/\(/g)?.length ?? 0;
  const closed = name.match(/\)/g)?.length ?? 0;
  if (opened > closed) name = `${name}${")".repeat(opened - closed)}`;
  return name;
}

/** A prescription photo contains the clinic, the person, and the dose columns. Keep medicine names only. */
export function isMedicineLine(line: string, records: DisplayRecord[]): boolean {
  return classify(line.replace(/\s+/g, " ").trim(), records) === "medicine";
}

export function medicineNames(text: string, candidates: string[], records: DisplayRecord[]): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const pool = (lines.length > 0 ? lines : candidates).map((line) => {
    const trimmed = line.replace(/\s+/g, " ").trim();
    const stripped = trimmed.replace(/^\d{1,2}\s+(?=[A-Za-z])/, "");
    if (isFormOnly(stripped) || DOSE_ONLY.test(trimmed) || DURATION_ONLY.test(stripped)) return trimmed;
    return stripped;
  });
  const kept: string[] = [];
  const seen = new Set<string>();
  let current = "";

  function commit() {
    const name = tidy(current);
    current = "";
    if (!name || !/[A-Za-z]{3,}/.test(name)) return;
    if (!hasMedicineSignal(name) && !catalogMedicine(name, records) && !/^[A-Z][a-z]{5,}(?:\s|$)/.test(name)) return;
    const key = name.toLowerCase().replace(/(?:tablets?|capsules?)/g, "").replace(/[^a-z0-9+]/g, "");
    if (key.length < 4 || seen.has(key)) return;
    seen.add(key);
    kept.push(name);
  }

  for (let index = 0; index < pool.length; index += 1) {
    const line = pool[index] ?? "";
    const kind = classify(line, records);
    if (kind === "skip") continue;
    if (kind === "form") {
      const word = formWord(line);
      if (current && word && !FORM.test(current) && !current.includes("(")) current = `${current} ${word}`;
      continue;
    }
    if (kind === "strength" || kind === "fragment") {
      if (current) current = `${current} ${line}`;
      else if (kind === "fragment" && hasMedicineSignal(tidy(line))) current = line;
      continue;
    }
    if (/^[A-Z][a-z]{5,}$/.test(line) && !hasMedicineSignal(line) && !catalogMedicine(line, records)) {
      const next = pool.slice(index + 1).find((item) => classify(item, records) !== "skip");
      if (!next || (classify(next, records) !== "strength" && classify(next, records) !== "form")) continue;
    }
    if (current) commit();
    current = line;
  }
  if (current) commit();
  return kept;
}

export function linesFromOcr(text: string, candidates: string[], records: DisplayRecord[]): RxLine[] {
  return medicineNames(text, candidates, records).map((name) => buildLine(name, records));
}
