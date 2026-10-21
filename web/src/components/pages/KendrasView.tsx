"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { kendrasForPin, type ListedKendra } from "@/lib/kendra/pin";
import { BUNDLED_KENDRAS, mapsSearchUrl, nearestKendras, type KendraHit } from "@/lib/kendra/nearest";

type Phase = "idle" | "empty" | "denied" | "unavailable" | "pin";

export function KendrasView() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState<"kendras.pinError" | "kendras.noPin" | null>(null);
  const [hits, setHits] = useState<KendraHit[]>([]);
  const [listed, setListed] = useState<ListedKendra[]>([]);
  const h1 = t("kendras.h1");
  const lede = t("kendras.lede");
  const locate = t("action.useLocation");
  const empty = t("kendras.empty");
  const denied = t("kendras.denied");
  const unavailable = t("kendras.unavailable");
  const pinLabel = t("kendras.pinLabel");
  const look = t("action.lookUpPin");
  const call = t("kendras.callAhead");
  const noDate = t("kendras.noDate");
  const phone = t("kendras.phone");
  const maps = t("action.maps");

  function showNearest(lat: number, lng: number) {
    const next = nearestKendras({ lat, lng }, BUNDLED_KENDRAS, 3);
    setListed([]);
    setHits(next);
    setPhase(next.length === 0 ? "empty" : "idle");
  }

  return (
    <div className="stack">
      <h1 lang={h1.locale}>{h1.text}</h1>
      <p className="lede" lang={lede.locale}>
        {lede.text}
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          lang={locate.locale}
          onClick={() => {
            if (!navigator.geolocation) {
              setPhase("unavailable");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => {
                showNearest(position.coords.latitude, position.coords.longitude);
              },
              (error) => {
                setHits([]);
                setListed([]);
                setPhase(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
              },
              { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 },
            );
          }}
        >
          {locate.text}
        </button>
      </div>
      {phase === "empty" ? <p lang={empty.locale}>{empty.text}</p> : null}
      {phase === "denied" ? <p role="alert" lang={denied.locale}>{denied.text}</p> : null}
      {phase === "unavailable" ? <p role="alert" lang={unavailable.locale}>{unavailable.text}</p> : null}
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          const found = kendrasForPin(pin);
          setHits([]);
          if (found === "invalid") {
            setListed([]);
            setPinMessage("kendras.pinError");
            return;
          }
          setListed(found);
          setPinMessage(found.length === 0 ? "kendras.noPin" : null);
          setPhase("pin");
        }}
      >
        <label className="field" lang={pinLabel.locale}>
          {pinLabel.text}
          <input inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} />
        </label>
        <button type="submit" className="btn btn-secondary" lang={look.locale}>
          {look.text}
        </button>
      </form>
      {pinMessage === "kendras.pinError" ? <p role="alert">{t("kendras.pinError").text}</p> : null}
      {pinMessage === "kendras.noPin" ? <p role="status">{t("kendras.noPin").text}</p> : null}
      {listed.length > 0 ? (
        <ol>
          {listed.map((row) => {
            const place = `${row.address}, ${row.district}, ${row.state} ${row.pin}`;
            return (
              <li key={row.id} className="medicine-row">
                <h2>{row.name}</h2>
                <p>{row.id}</p>
                <p>{place}</p>
                <p lang={noDate.locale}>{noDate.text}</p>
                <p lang={call.locale}>{call.text}</p>
                <a href={mapsSearchUrl(`${row.name}, ${place}`)} rel="noopener noreferrer" target="_blank" lang={maps.locale}>
                  {maps.text}
                </a>
              </li>
            );
          })}
        </ol>
      ) : null}
      {hits.length > 0 ? (
        <ol>
          {hits.map((hit) => (
            <li key={hit.id} className="medicine-row">
              <h2>{hit.name}</h2>
              <p>{hit.distanceKm.toFixed(1)} km</p>
              <p>{hit.address}</p>
              {hit.phone ? (
                <p>
                  <span lang={phone.locale}>{phone.text}</span> {hit.phone}
                </p>
              ) : null}
              <p lang={hit.updated ? undefined : noDate.locale}>{hit.updated ?? noDate.text}</p>
              <p lang={call.locale}>{call.text}</p>
              <a href={mapsSearchUrl(hit.address)} rel="noopener noreferrer" target="_blank" lang={maps.locale}>
                {maps.text}
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
