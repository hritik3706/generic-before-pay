import { GemmaBackendProvider } from "@/lib/ocr/gemma";
import { LocalOcrProvider } from "@/lib/ocr/local";
import { MockOcrProvider } from "@/lib/ocr/mock";
import type { OcrProvider } from "@/lib/ocr/types";

export type OcrKind = "local" | "mock" | "gemma";

export function defaultOcrKind(): OcrKind {
  const value = process.env.NEXT_PUBLIC_OCR_PROVIDER;
  if (value === "gemma" || value === "mock" || value === "local") return value;
  return "local";
}

export function createOcrProvider(kind: OcrKind = defaultOcrKind(), timeoutMs?: number): OcrProvider {
  if (kind === "gemma") return new GemmaBackendProvider("/v1/ocr", timeoutMs);
  if (kind === "mock") return new MockOcrProvider();
  return new LocalOcrProvider();
}

/** Test hook: `?ocr=gemma`, `?ocr=mock`, or `?ocr=local` on /scan. Not a place for prescription text. */
export function ocrKindFromLocation(search: string, fallback: OcrKind = defaultOcrKind()): OcrKind {
  const value = new URLSearchParams(search).get("ocr");
  if (value === "gemma" || value === "mock" || value === "local") return value;
  return fallback;
}
