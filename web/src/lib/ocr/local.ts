import { loadBundledCatalog } from "@/lib/data/load";
import { fitForOcr } from "@/lib/image/enhance";
import { medicineNamesFromPrintedText } from "@/lib/ocr/candidates";
import { catalogNamesInText } from "@/lib/ocr/printed";
import { OCR_NOTICE, OcrClientError, type OcrProvider, type OcrReadOptions, type OcrResult } from "@/lib/ocr/types";
import type { DisplayRecord } from "@/lib/data/types";

const LOCAL_TIMEOUT_MS = 70_000;

type OcrWorker = {
  recognize(image: Blob): Promise<{ data: { text: string } }>;
  setParameters(params: Record<string, string>): Promise<unknown>;
  terminate(): Promise<unknown>;
};

export class LocalOcrProvider implements OcrProvider {
  async readText(image: Blob, opts: OcrReadOptions): Promise<OcrResult> {
    if (opts.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const { createWorker } = await import("tesseract.js");
    const lang = opts.lang === "hi" ? "hin+eng" : "eng";
    let worker: OcrWorker | undefined;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      void worker?.terminate();
    }, LOCAL_TIMEOUT_MS);
    const onAbort = () => {
      void worker?.terminate();
    };
    opts.signal.addEventListener("abort", onAbort);
    try {
      worker = (await createWorker(lang)) as OcrWorker;
      const catalog = loadBundledCatalog();
      const records = catalog.ok ? catalog.records : [];
      const fitted = await fitForOcr(image);
      const first = await readPass(worker, fitted, "3");
      let best = pickReadable(first, "", records);
      if (medicineNamesFromPrintedText(best.text).length < 2 && !opts.signal.aborted) {
        const second = await readPass(worker, image, "6");
        best = pickReadable(first, second, records);
      }
      if (opts.signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (best.names.length === 0) throw new OcrClientError("OCR_BAD_OUTPUT");
      return {
        requestId: "local-ocr",
        text: best.text,
        candidates: best.names,
        language: opts.lang ?? "en",
        provider: "tesseract",
        mock: false,
        preprocessed: fitted !== image,
        notice: OCR_NOTICE,
      };
    } catch (error) {
      if (error instanceof OcrClientError) throw error;
      if (timedOut) throw new OcrClientError("OCR_TIMEOUT");
      if (opts.signal.aborted) throw error;
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw new OcrClientError("OFFLINE");
      throw new OcrClientError("OCR_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
      opts.signal.removeEventListener("abort", onAbort);
      await worker?.terminate().catch(() => undefined);
    }
  }
}

async function readPass(worker: OcrWorker, image: Blob, pageMode: string): Promise<string> {
  await worker.setParameters({
    tessedit_pageseg_mode: pageMode,
    preserve_interword_spaces: "1",
  }).catch(() => undefined);
  const recognized = await worker.recognize(image);
  return recognized.data.text.trim();
}

function pickReadable(first: string, second: string, records: DisplayRecord[]): { text: string; names: string[] } {
  const firstScore = readScore(first, records);
  const secondScore = second ? readScore(second, records) : { score: -1, names: [] as string[] };
  if (secondScore.score > firstScore.score) return { text: second, names: secondScore.names };
  return { text: first, names: firstScore.names };
}

function readScore(text: string, records: DisplayRecord[]): { score: number; names: string[] } {
  const printed = medicineNamesFromPrintedText(text);
  const listed = catalogNamesInText(text, records);
  const names = printed.length > 0 ? printed : listed;
  return { score: printed.length * 10 + listed.length, names };
}
