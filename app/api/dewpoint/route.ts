// GET /api/dewpoint
//
// Finds and interprets the dew-point prediction for a location.
//
// Query (one of):
//   ?q=Denver                 — free-text place name (geocoded)
//   ?lat=39.74&lon=-104.98     — explicit coordinates
// Optional:
//   ?days=1..7                 — forecast horizon (default 3)
//
// Response 200 (JSON):
//   {
//     "location": { name, latitude, longitude, timezone, ... },
//     "hours":    [ { time, temperatureC, dewpointC, relativeHumidity? }, ... ],
//     "insights": {
//        peak, trough, averageDewpointC, fog, comfortWindow, summary
//     }
//   }
//
// Errors: 400 (bad query), 404 (place not found), 502/504 (upstream), all
// as { "error": "<message>" }. No auth, no cookies — this is a public,
// read-only endpoint. Cached at the edge for 10 minutes since dew-point
// predictions don't move minute to minute.

import { type NextRequest, NextResponse } from "next/server";

import {
  dewpointQuerySchema,
  findDewpointForecast,
  summarizeForecast,
  DewpointError,
} from "@/lib/dewpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const parsed = dewpointQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    lat: params.get("lat") ?? undefined,
    lon: params.get("lon") ?? undefined,
    days: params.get("days") ?? undefined,
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid query.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const forecast = await findDewpointForecast(parsed.data);
    const insights = summarizeForecast(forecast.hours);
    return NextResponse.json(
      { location: forecast.location, hours: forecast.hours, insights },
      { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=1200" } },
    );
  } catch (err) {
    if (err instanceof DewpointError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unexpected error fetching the forecast." }, { status: 500 });
  }
}
