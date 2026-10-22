import { lookupDirectory } from "@/lib/kendra/directory";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pin = url.searchParams.get("pin") ?? undefined;
  const latRaw = url.searchParams.get("lat");
  const lngRaw = url.searchParams.get("lng");
  const lat = latRaw === null || latRaw === "" ? undefined : Number(latRaw);
  const lng = lngRaw === null || lngRaw === "" ? undefined : Number(lngRaw);
  if (pin && !/^\d{6}$/.test(pin)) return NextResponse.json({ status: "invalid", hits: [] });
  if ((lat !== undefined && !Number.isFinite(lat)) || (lng !== undefined && !Number.isFinite(lng))) {
    return NextResponse.json({ status: "invalid", hits: [] });
  }
  const result = await lookupDirectory({ pin, lat, lng });
  return NextResponse.json(result);
}
