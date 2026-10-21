import { GemmaBackendProvider } from "@/lib/ocr/gemma";
import { MockOcrProvider } from "@/lib/ocr/mock";
import type { OcrProvider } from "@/lib/ocr/types";

export function defaultOcrKind(): "mock" | "gemma" {
  return process.env.NEXT_PUBLIC_OCR_PROVIDER === "mock" ? "mock" : "gemma";
}

export function createOcrProvider(kind: "mock" | "gemma" = defaultOcrKind(), timeoutMs?: number): OcrProvider {
  return kind === "gemma" ? new GemmaBackendProvider("/v1/ocr", timeoutMs) : new MockOcrProvider();
}

/** Test hook: `?ocr=gemma` or `?ocr=mock` on /scan. Not a place for prescription text. */
export function ocrKindFromLocation(search: string, fallback: "mock" | "gemma" = defaultOcrKind()): "mock" | "gemma" {
  const value = new URLSearchParams(search).get("ocr");
  if (value === "gemma" || value === "mock") return value;
  return fallback;
}
