import type { MatchReason, Tier } from "@/lib/matching/match";

export type Gender = "female" | "male" | "other" | "prefer_not_to_say";

export type RxLine = {
  key: string;
  query: string;
  tier: Tier;
  reason: MatchReason;
  candidateIds: string[];
  selectedId: string | null;
  confirmed: boolean;
  quantity: number;
};

export type PatientState = {
  ageYears: string;
  gender: Gender | "";
  confirmed: boolean;
};

export type OcrSnapshot = {
  text: string;
  mock: boolean;
  provider: string;
};

export type SessionState = {
  started: boolean;
  lines: RxLine[];
  patient: PatientState;
  ocr: OcrSnapshot | null;
};

export const emptyPatient: PatientState = { ageYears: "", gender: "", confirmed: false };

export const initialSession: SessionState = {
  started: false,
  lines: [],
  patient: emptyPatient,
  ocr: null,
};

export type SessionAction =
  | { type: "start" }
  | { type: "reset" }
  | { type: "addLine"; line: RxLine }
  | { type: "setLines"; lines: RxLine[] }
  | { type: "replaceLine"; line: RxLine }
  | { type: "removeLine"; key: string }
  | { type: "confirmLine"; key: string; selectedId: string }
  | { type: "setQuantity"; key: string; quantity: number }
  | { type: "setAge"; ageYears: string }
  | { type: "setGender"; gender: Gender | "" }
  | { type: "confirmPatient" }
  | { type: "editPatient" }
  | { type: "setOcr"; ocr: OcrSnapshot }
  | { type: "clearOcr" };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "start":
      return { ...state, started: true };
    case "reset":
      return initialSession;
    case "addLine":
      return { ...state, started: true, lines: [...state.lines, action.line] };
    case "setLines":
      return { ...state, started: true, lines: action.lines };
    case "replaceLine":
      return {
        ...state,
        lines: state.lines.map((line) => (line.key === action.line.key ? action.line : line)),
      };
    case "removeLine":
      return { ...state, lines: state.lines.filter((line) => line.key !== action.key) };
    case "confirmLine":
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.key === action.key ? { ...line, selectedId: action.selectedId, confirmed: true } : line,
        ),
      };
    case "setQuantity":
      return {
        ...state,
        lines: state.lines.map((line) =>
          line.key === action.key ? { ...line, quantity: action.quantity } : line,
        ),
      };
    case "setAge":
      return { ...state, patient: { ...state.patient, ageYears: action.ageYears, confirmed: false } };
    case "setGender":
      return { ...state, patient: { ...state.patient, gender: action.gender, confirmed: false } };
    case "confirmPatient":
      return { ...state, patient: { ...state.patient, confirmed: true } };
    case "editPatient":
      return { ...state, patient: { ...state.patient, confirmed: false } };
    case "setOcr":
      return { ...state, started: true, ocr: action.ocr };
    case "clearOcr":
      return { ...state, ocr: null };
  }
}

export function hasConfirmedLine(state: SessionState): boolean {
  return state.lines.some((line) => line.confirmed && line.selectedId !== null);
}
