"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PrivacySlot } from "@/components/PrivacySlot";
import { DemoBadge } from "@/components/DemoBadge";
import { prepareImage } from "@/lib/image/prepare";
import { loadBundledCatalog } from "@/lib/data/load";
import { messageKeyForCode } from "@/lib/ocr/errors";
import { createOcrProvider, ocrKindFromLocation, type OcrKind } from "@/lib/ocr/provider";
import { OcrClientError, type OcrFailureCode, type OcrProvider } from "@/lib/ocr/types";
import { useI18n } from "@/lib/i18n/context";
import { linesFromOcr } from "@/lib/session/lines";
import { useSession } from "@/lib/session/context";

type Failure = { code: OcrFailureCode; retryAfter: number | null };

export function ScanView({ provider }: { provider?: OcrProvider }) {
  const { t, lang } = useI18n();
  const { dispatch } = useSession();
  const router = useRouter();
  const uploadRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [reading, setReading] = useState(false);
  const [handwriting, setHandwriting] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const generation = useRef(0);
  const h1 = t("scan.h1");
  const lede = t("scan.lede");
  const choose = t("scan.choose");
  const camera = t("scan.camera");
  const handwritingLabel = t("scan.handwriting");
  const progress = t("scan.progress");
  const cancel = t("action.cancelScan");
  const retry = t("action.retry");
  const instead = t("action.typeInstead");
  const retake = t("action.retake");
  const wait = t("scan.wait");

  function kind(): OcrKind {
    if (typeof window === "undefined") return "local";
    return ocrKindFromLocation(window.location.search);
  }

  async function readFile(file: File | undefined) {
    setFailure(null);
    if (!file) {
      setFailure({ code: "EMPTY_IMAGE", retryAfter: null });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false && kind() === "gemma") {
      setFailure({ code: "OFFLINE", retryAfter: null });
      return;
    }
    const prepared = await prepareImage(file);
    if ("problem" in prepared) {
      const code = prepared.problem === "type" ? "UNSUPPORTED_IMAGE" : prepared.problem === "empty" ? "EMPTY_IMAGE" : "FILE_TOO_LARGE";
      setFailure({ code, retryAfter: null });
      return;
    }
    const mine = ++generation.current;
    const useHandwriting = handwriting;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setReading(true);
    const timeoutParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("ocrTimeout");
    const parsedTimeout = timeoutParam === null ? undefined : Number(timeoutParam);
    const timeoutMs = parsedTimeout !== undefined && parsedTimeout >= 50 && parsedTimeout <= 25_000 ? parsedTimeout : undefined;
    const active = provider ?? createOcrProvider(kind(), timeoutMs);
    try {
      const result = await active.readText(prepared.blob, {
        signal: controller.signal,
        lang,
        handwriting: useHandwriting,
      });
      if (mine !== generation.current || controller.signal.aborted) return;
      const catalog = loadBundledCatalog();
      const records = catalog.ok ? catalog.records : [];
      dispatch({ type: "setLines", lines: linesFromOcr(result.text, result.candidates, records) });
      dispatch({ type: "setOcr", ocr: { text: result.text, mock: result.mock, provider: result.provider } });
      router.push("/review");
    } catch (error) {
      if (mine !== generation.current) return;
      if (controller.signal.aborted && !(error instanceof OcrClientError)) return;
      if (error instanceof OcrClientError) {
        setFailure({ code: error.code, retryAfter: error.retryAfter });
        return;
      }
      setFailure({ code: "NETWORK", retryAfter: null });
    } finally {
      if (mine === generation.current) {
        setReading(false);
        abortRef.current = null;
      }
    }
  }

  async function openCamera() {
    setFailure(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      uploadRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((track) => track.stop());
      uploadRef.current?.setAttribute("capture", "environment");
      uploadRef.current?.click();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setFailure({ code: "CAMERA_DENIED", retryAfter: null });
      }
      uploadRef.current?.removeAttribute("capture");
      uploadRef.current?.click();
    }
  }

  const errorCopy = failure ? t(messageKeyForCode(failure.code)) : null;

  return (
    <div className="stack">
      <h1 lang={h1.locale}>{h1.text}</h1>
      <p className="lede" lang={lede.locale}>
        {lede.text}
      </p>
      <DemoBadge />
      <input
        ref={uploadRef}
        className="file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={choose.text}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void readFile(file);
        }}
      />
      <label className="check-row">
        <input
          type="checkbox"
          checked={handwriting}
          disabled={reading}
          onChange={(event) => setHandwriting(event.target.checked)}
        />
        <span lang={handwritingLabel.locale}>{handwritingLabel.text}</span>
      </label>
      <div className="actions">
        <button type="button" className="btn btn-primary" lang={camera.locale} disabled={reading} onClick={() => void openCamera()}>
          {camera.text}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          lang={choose.locale}
          disabled={reading}
          onClick={() => {
            uploadRef.current?.removeAttribute("capture");
            uploadRef.current?.click();
          }}
        >
          {choose.text}
        </button>
      </div>
      {reading ? (
        <p role="status" lang={progress.locale}>
          {progress.text}
        </p>
      ) : null}
      {reading ? (
        <button
          type="button"
          className="btn btn-secondary"
          lang={cancel.locale}
          onClick={() => abortRef.current?.abort()}
        >
          {cancel.text}
        </button>
      ) : null}
      {failure && errorCopy ? (
        <div role="alert">
          <p lang={errorCopy.locale}>{errorCopy.text}</p>
          {failure.retryAfter !== null ? (
            <p lang={wait.locale}>
              {wait.text} {failure.retryAfter}
            </p>
          ) : null}
          <div className="actions">
            <button type="button" className="btn btn-secondary" lang={retry.locale} onClick={() => setFailure(null)}>
              {retry.text}
            </button>
            <button type="button" className="btn btn-secondary" lang={retake.locale} onClick={() => uploadRef.current?.click()}>
              {retake.text}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              lang={instead.locale}
              onClick={() => {
                dispatch({ type: "start" });
                router.push("/review");
              }}
            >
              {instead.text}
            </button>
          </div>
        </div>
      ) : null}
      <PrivacySlot />
    </div>
  );
}
