/**
 * lib/dewpoint/client.ts
 *
 * The "finds" half of the feature: it locates a place and pulls its hourly
 * dew-point prediction. Backed by Open-Meteo, which is free, keyless, and
 * needs no attribution beyond a courtesy link — so this feature works out
 * of the box with no secrets to configure.
 *
 *   - Geocoding:  https://geocoding-api.open-meteo.com/v1/search
 *   - Forecast:   https://api.open-meteo.com/v1/forecast
 *
 * Both endpoints are wrapped in a small timeout and return typed results or
 * throw a DewpointError with a caller-safe message.
 */

import type { DewpointHour } from "./derive";
import type { ResolvedLocation } from "./types";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUT_MS = 8000;

/** A network/parse failure with a message safe to show a user. */
export class DewpointError extends Error {
  constructor(
    message: string,
    /** Suggested HTTP status for an API route to surface. */
    readonly status = 502,
  ) {
    super(message);
    this.name = "DewpointError";
  }
}

/**
 * Resolve a free-text place name to coordinates + timezone. Returns the
 * top match. Throws DewpointError(404) when nothing matches.
 */
export async function geocode(query: string, fetchImpl: typeof fetch = fetch): Promise<ResolvedLocation> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const data = await getJson(url, fetchImpl);
  const top = Array.isArray(data?.results) ? data.results[0] : undefined;
  if (!top || typeof top.latitude !== "number" || typeof top.longitude !== "number") {
    throw new DewpointError(`No place found matching "${query}".`, 404);
  }

  return {
    name: [top.name, top.admin1, top.country].filter(Boolean).join(", "),
    latitude: top.latitude,
    longitude: top.longitude,
    timezone: typeof top.timezone === "string" ? top.timezone : "auto",
    country: typeof top.country === "string" ? top.country : undefined,
    admin1: typeof top.admin1 === "string" ? top.admin1 : undefined,
  };
}

export interface DewpointForecast {
  location: ResolvedLocation;
  hours: DewpointHour[];
}

/**
 * Fetch the hourly dew-point prediction for a resolved location. `days`
 * clamps to 1–7 (Open-Meteo's free hourly window). When the location's
 * timezone is "auto", Open-Meteo picks it from the coordinates and echoes
 * it back, which we thread into the returned location.
 */
export async function fetchDewpointForecast(
  location: ResolvedLocation,
  days = 3,
  fetchImpl: typeof fetch = fetch,
): Promise<DewpointForecast> {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("hourly", "dew_point_2m,temperature_2m,relative_humidity_2m");
  url.searchParams.set("forecast_days", String(clampInt(days, 1, 7)));
  url.searchParams.set("timezone", location.timezone || "auto");

  const data = await getJson(url, fetchImpl);
  const hourly = data?.hourly;
  const times: unknown = hourly?.time;
  const dewpoints: unknown = hourly?.dew_point_2m;
  const temps: unknown = hourly?.temperature_2m;
  const humidity: unknown = hourly?.relative_humidity_2m;

  if (!Array.isArray(times) || !Array.isArray(dewpoints) || !Array.isArray(temps)) {
    throw new DewpointError("Forecast source returned an unexpected shape.");
  }

  const hours: DewpointHour[] = [];
  for (let i = 0; i < times.length; i++) {
    const dp = dewpoints[i];
    const t = temps[i];
    if (typeof times[i] !== "string" || typeof dp !== "number" || typeof t !== "number") continue;
    const rh = Array.isArray(humidity) ? humidity[i] : undefined;
    hours.push({
      time: times[i] as string,
      dewpointC: dp,
      temperatureC: t,
      relativeHumidity: typeof rh === "number" ? rh : undefined,
    });
  }

  if (hours.length === 0) {
    throw new DewpointError("Forecast source returned no usable hours.");
  }

  return {
    location: {
      ...location,
      timezone: typeof data?.timezone === "string" ? data.timezone : location.timezone,
    },
    hours,
  };
}

/**
 * Top-level convenience: resolve a place name (or accept coordinates) and
 * return its dew-point forecast in one call.
 */
export async function findDewpointForecast(
  input: { q?: string; lat?: number; lon?: number; days?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<DewpointForecast> {
  let location: ResolvedLocation;
  if (input.lat !== undefined && input.lon !== undefined) {
    location = {
      name: `${round2(input.lat)}, ${round2(input.lon)}`,
      latitude: input.lat,
      longitude: input.lon,
      timezone: "auto",
    };
  } else if (input.q) {
    location = await geocode(input.q, fetchImpl);
  } else {
    throw new DewpointError("Provide a place name or coordinates.", 400);
  }
  return fetchDewpointForecast(location, input.days ?? 3, fetchImpl);
}

async function getJson(url: URL, fetchImpl: typeof fetch): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      throw new DewpointError(`Weather source responded ${res.status}.`, 502);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof DewpointError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new DewpointError("Weather source timed out.", 504);
    }
    throw new DewpointError("Could not reach the weather source.", 502);
  } finally {
    clearTimeout(timer);
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
