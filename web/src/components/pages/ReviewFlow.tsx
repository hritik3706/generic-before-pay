"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DidYouMean } from "@/components/DidYouMean";
import { DemoBadge } from "@/components/DemoBadge";
import { MatchStatus } from "@/components/MatchStatus";
import { VoiceButton } from "@/components/VoiceButton";
import { OCR_NOTICE } from "@/lib/ocr/types";
import { loadBundledCatalog } from "@/lib/data/load";
import { useI18n } from "@/lib/i18n/context";
import { buildLine } from "@/lib/session/lines";
import { hasConfirmedLine } from "@/lib/session/reducer";
import { useSession } from "@/lib/session/context";

export function ReviewFlow() {
  const { t } = useI18n();
  const { state, dispatch } = useSession();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const leavingRef = useRef(false);
  const catalog = loadBundledCatalog();
  const records = catalog.ok ? catalog.records : [];
  const h1 = t("review.h1");
  const lede = t("review.lede");
  const query = t("review.query");
  const add = t("action.add");
  const empty = t("review.empty");
  const need = t("review.needConfirm");
  const cont = t("action.continue");
  const raw = t("review.raw");
  const canContinue = hasConfirmedLine(state);

  function addQuery(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    dispatch({ type: "addLine", line: buildLine(trimmed, records) });
    setDraft("");
  }

  return (
    <div className="stack">
      <h1 lang={h1.locale}>{h1.text}</h1>
      <p className="lede" lang={lede.locale}>
        {lede.text}
      </p>
      <DemoBadge />
      {state.ocr ? (
        <section aria-labelledby="ocr-text">
          <h2 id="ocr-text" lang={raw.locale}>
            {raw.text}
          </h2>
          {state.ocr.mock ? <DemoBadge reading /> : null}
          <p lang="en">{OCR_NOTICE}</p>
          <pre className="raw-text">{state.ocr.text}</pre>
        </section>
      ) : null}
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          addQuery(draft);
        }}
      >
        <label className="field" lang={query.locale}>
          {query.text}
          <input value={draft} onChange={(event) => setDraft(event.target.value)} name="medicine" autoComplete="off" />
        </label>
        <div className="actions">
          <button type="submit" className="btn btn-primary" lang={add.locale}>
            {add.text}
          </button>
          <VoiceButton onText={addQuery} />
        </div>
      </form>
      {state.lines.length === 0 ? <p lang={empty.locale}>{empty.text}</p> : null}
      <ul className="plain-list">
        {state.lines.map((line) => {
          const record = records.find((item) => item.id === line.selectedId);
          const name = record?.brandName ?? line.query;
          const confirm = t("action.confirmName");
          const remove = t("action.delete");
          const edit = t("action.edit");
          const qty = t("review.quantity");
          return (
            <li key={line.key} className="medicine-row">
              <h2>{name}</h2>
              <MatchStatus tier={line.tier} />
              <label className="field" lang={edit.locale}>
                {edit.text}
                <input
                  defaultValue={line.query}
                  aria-label={`${edit.text} ${line.query}`}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next && next !== line.query) {
                      dispatch({ type: "replaceLine", line: { ...buildLine(next, records, line.key), quantity: line.quantity } });
                    }
                  }}
                />
              </label>
              {!line.confirmed && line.tier !== "exact" && line.tier !== "likely" ? (
                <DidYouMean
                  reason={line.reason}
                  candidateIds={line.candidateIds}
                  records={records}
                  onPick={(id) => dispatch({ type: "confirmLine", key: line.key, selectedId: id })}
                />
              ) : null}
              {line.selectedId && !line.confirmed ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  lang={confirm.locale}
                  onClick={() => {
                    if (line.selectedId) dispatch({ type: "confirmLine", key: line.key, selectedId: line.selectedId });
                  }}
                >
                  {confirm.text}: {name}
                </button>
              ) : null}
              {line.confirmed ? (
                <label className="field" lang={qty.locale}>
                  {qty.text}
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity}
                    onChange={(event) => {
                      const quantity = Number(event.target.value);
                      if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) {
                        dispatch({ type: "setQuantity", key: line.key, quantity });
                      }
                    }}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => dispatch({ type: "removeLine", key: line.key })}
              >
                <span lang={remove.locale}>{remove.text}</span> {name}
              </button>
            </li>
          );
        })}
      </ul>
      {!canContinue ? (
        <p id="continue-note" lang={need.locale}>
          {need.text}
        </p>
      ) : null}
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          lang={cont.locale}
          disabled={!canContinue}
          aria-describedby={canContinue ? undefined : "continue-note"}
          onClick={() => {
            if (leavingRef.current) return;
            leavingRef.current = true;
            router.push("/patient");
            window.setTimeout(() => {
              leavingRef.current = false;
            }, 1000);
          }}
        >
          {cont.text}
        </button>
      </div>
    </div>
  );
}
