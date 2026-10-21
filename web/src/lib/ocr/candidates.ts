const MAX_CANDIDATES = 12;

const LEADING_INDEX = /^\d+\s*[.)]\s*/;
const LEADING_FORM =
  /^(?:tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|inj|injection)\.?\s+/i;
const DOSE_TAIL =
  /\b(?:\d\s*[-–]\s*\d\s*[-–]\s*\d|od|bd|tds|qid|hs|sos|stat|af|bf|x\s*\d+(?:\s*days?)?|for\s+\d+\s*days?|after\s+food|before\s+food|with\s+water)\b/gi;
const HEADER =
  /^(?:dr|doctor|date|name|age|sex|gender|address|phone|mobile|rx|regd|reg|registration|hospital|clinic|signature|patient|weight|bp)\b/i;
const TRAILING_FORM =
  /\s+(?:tab|tabs|tablet|tablets|cap|caps|capsule|capsules|syp|syrup|inj|injection|gel|cream|drops?|ointment|susp|suspension)\.?$/i;
const CLINICAL =
  /\b(?:symptoms?|diagnosis|diagnosed|complaint|history|advice|examination|investigation|follow[\s-]?up|pain|ache|fever|cough|swelling|weakness|dizziness|nausea|vomit(?:ing)?|relieved|releived|relief|fasci(?:i)?tis|stroke|heel|plantar|planter|activity|tenderness|oedema|edema)\b/i;
const CLINICAL_MARK = /\b(?:h\s*\/\s*o|c\s*\/\s*o|k\s*\/\s*c\s*\/\s*o|b\s*\/\s*l)\b/i;
const NOTE_WORD = new Set([
  "activity",
  "advice",
  "diagnosis",
  "history",
  "pain",
  "rest",
  "symptom",
  "symptoms",
]);
const FORM_WORD = String.raw`\b(tablets?|capsules?|syrups?|injections?)\b`;
const STOP_TOKEN = new Set([
  "advice",
  "after",
  "ago",
  "back",
  "before",
  "breakfast",
  "capsule",
  "capsules",
  "daily",
  "day",
  "days",
  "diagnosis",
  "dose",
  "duration",
  "empty",
  "frequency",
  "injection",
  "injections",
  "meal",
  "medication",
  "medications",
  "once",
  "pain",
  "prescription",
  "remarks",
  "sos",
  "stomach",
  "syrup",
  "tablet",
  "tablets",
  "twice",
  "week",
  "weeks",
  "year",
  "years",
]);

/** Product titles from a printed prescription, including names that are not in the price list. */
export function medicineNamesFromPrintedText(text: string): string[] {
  const flat = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
  const names: string[] = [];
  const seen = new Set<string>();
  for (const match of flat.matchAll(new RegExp(FORM_WORD, "gi"))) {
    const brand = trailingBrand(flat.slice(0, match.index));
    if (!brand || CLINICAL.test(brand)) continue;
    const title = `${brand} ${formTitle(match[1] ?? "")}`;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(title);
    if (names.length >= MAX_CANDIDATES) break;
  }
  return names;
}

function trailingBrand(before: string): string | null {
  const tokens = before.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  let skipped = 0;
  for (let index = tokens.length - 1; index >= 0 && kept.length < 4 && skipped < 14; index -= 1) {
    const token = (tokens[index] ?? "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%./+-]+$/gu, "");
    if (!token) {
      skipped += 1;
      continue;
    }
    if (/^\d+$/.test(token) && index === tokens.length - 1) break;
    if (isDoseToken(token) || !/^[A-Za-z0-9][A-Za-z0-9.%/+-]*$/.test(token)) {
      if (kept.length > 0) break;
      skipped += 1;
      continue;
    }
    kept.unshift(token);
  }
  const brand = kept.join(" ").trim();
  if (!/[\p{L}]{3,}/u.test(brand)) return null;
  return brand;
}

/** Dose, schedule, and diagnosis leftovers. A bare count such as "1 tablet" still ends the walk. */
function isDoseToken(token: string): boolean {
  const lower = token.toLowerCase();
  return (
    STOP_TOKEN.has(lower) ||
    /^x\d+$/i.test(token) ||
    /^\d+$/.test(token) ||
    /^\d+-\d+-\d+$/.test(token) ||
    /^\d+(?:\.\d+)?mg$/i.test(token) ||
    /^[A-Za-z]$/.test(token)
  );
}

/** Keep medicine-like lines read from a prescription. Does not add names that were not in the text. */
export function candidatesFromOcrText(text: string): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = cleanLine(raw);
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(line);
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  return candidates;
}

function formTitle(form: string): string {
  const lower = form.toLowerCase();
  if (lower.startsWith("cap")) return "Capsule";
  if (lower.startsWith("syr")) return "Syrup";
  if (lower.startsWith("inj")) return "Injection";
  return "Tablet";
}

function cleanLine(raw: string): string | null {
  let line = raw.replace(LEADING_INDEX, "").replace(LEADING_FORM, "");
  line = line.replace(DOSE_TAIL, " ");
  line = line.replace(/[|•·]+/g, " ").replace(/\s+/g, " ").trim();
  const withoutForm = line.replace(TRAILING_FORM, "").trim();
  if (/[\p{L}]{3,}/u.test(withoutForm)) line = withoutForm;
  line = line.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%./+-]+$/gu, "").trim();
  if (!/[\p{L}]{3,}/u.test(line)) return null;
  if (HEADER.test(line) || CLINICAL.test(line) || CLINICAL_MARK.test(line)) return null;
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(line)) return null;
  const words = line.toLowerCase().split(/\s+/);
  if (words.length === 1 && NOTE_WORD.has(words[0] ?? "")) return null;
  if (words.length >= 6 && !/\d/.test(line)) return null;
  return line;
}
