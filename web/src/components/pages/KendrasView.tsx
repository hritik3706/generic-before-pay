"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { mapsSearchUrl, type KendraHit } from "@/lib/kendra/nearest";

type Phase = "idle" | "empty" | "denied" | "unavailable" | "directory" | "pin";
type DirectoryBody = { status?: string; hits?: KendraHit[] };

export function KendrasView() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const [pin, setPin] = useState("");
  const [pinMessage, setPinMessage] = useState<"kendras.pinError" | "kendras.noPin" | null>(null);
  const [hits, setHits] = useState<KendraHit[]>([]);
  const [busy, setBusy] = useState(false);
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
  const loading = t("kendras.loading");
  const directory = t("kendras.directory");

  async function loadNearest(query: { lat?: number; lng?: number; pin?: string }) {
    setBusy(true);
    setPinMessage(null);
    setHits([]);
    try {
      const params = new URLSearchParams();
      if (query.pin) params.set("pin", query.pin);
      if (query.lat !== undefined) params.set("lat", String(query.lat));
      if (query.lng !== undefined) params.set("lng", String(query.lng));
      const response = await fetch(`/api/kendras/nearest?${params.toString()}`);
      if (!response.ok) throw new Error("directory");
      const body = (await response.json()) as DirectoryBody;
      const next = Array.isArray(body.hits) ? body.hits : [];
      if (body.status === "ok" && next.length > 0) {
        setHits(next);
        setPhase("idle");
        return;
      }
      if (body.status === "empty") {
        setPhase(query.pin ? "pin" : "empty");
        if (query.pin) setPinMessage("kendras.noPin");
        return;
      }
      setPhase("directory");
    } catch {
      setPhase("directory");
    } finally {
      setBusy(false);
    }
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
          disabled={busy}
          onClick={() => {
            if (!navigator.geolocation) {
              setPhase("unavailable");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (position) => {
                void loadNearest({ lat: position.coords.latitude, lng: position.coords.longitude });
              },
              (error) => {
                setHits([]);
                setPhase(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
              },
              { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 },
            );
          }}
        >
          {locate.text}
        </button>
      </div>
      {busy ? <p lang={loading.locale}>{loading.text}</p> : null}
      {phase === "empty" ? <p lang={empty.locale}>{empty.text}</p> : null}
      {phase === "denied" ? <p role="alert" lang={denied.locale}>{denied.text}</p> : null}
      {phase === "unavailable" ? <p role="alert" lang={unavailable.locale}>{unavailable.text}</p> : null}
      {phase === "directory" ? <p role="alert" lang={directory.locale}>{directory.text}</p> : null}
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!/^\d{6}$/.test(pin.trim())) {
            setPinMessage("kendras.pinError");
            setHits([]);
            setPhase("pin");
            return;
          }
          void loadNearest({ pin: pin.trim() });
        }}
      >
        <label className="field" lang={pinLabel.locale}>
          {pinLabel.text}
          <input inputMode="numeric" autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value)} />
        </label>
        <button type="submit" className="btn btn-secondary" lang={look.locale} disabled={busy}>
          {look.text}
        </button>
      </form>
      {pinMessage === "kendras.pinError" ? <p role="alert">{t("kendras.pinError").text}</p> : null}
      {pinMessage === "kendras.noPin" ? <p role="status">{t("kendras.noPin").text}</p> : null}
      {hits.length > 0 ? (
        <ol>
          {hits.map((hit) => (
            <li key={hit.id} className="medicine-row">
              <h2>{hit.name}</h2>
              {typeof hit.distanceKm === "number" ? <p>{hit.distanceKm.toFixed(1)} km</p> : null}
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
