"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> };
type SpeechRec = {
  lang: string;
  onresult: ((event: SpeechResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

function recognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Shown only when the browser exposes the Web Speech API. Otherwise the control is absent. */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { t, lang } = useI18n();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const label = t("action.voice");
  const live = t("review.voiceOn");

  useEffect(() => {
    setSupported(recognition() !== null);
  }, []);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        lang={label.locale}
        aria-pressed={listening}
        onClick={() => {
          const engine = recognition();
          if (!engine) return;
          engine.lang = lang === "hi" ? "hi-IN" : "en-IN";
          engine.onresult = (event) => {
            const last = event.results[event.results.length - 1];
            if (!last || last.isFinal === false) return;
            const text = last[0]?.transcript ?? "";
            if (text.trim()) onText(text.trim());
          };
          engine.onerror = () => setListening(false);
          engine.onend = () => setListening(false);
          setListening(true);
          engine.start();
        }}
      >
        {label.text}
      </button>
      {listening ? (
        <p role="status" lang={live.locale}>
          {live.text}
        </p>
      ) : null}
    </>
  );
}
