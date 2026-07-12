/**
 * lib/dewpoint/derive.ts
 *
 * Pure functions that turn a raw dew-point prediction into the things a
 * human actually cares about: how muggy it will feel, whether fog is
 * likely, whether surfaces will "sweat" (condensation), and when the most
 * comfortable window of the day is.
 *
 * Everything here is unit-based and side-effect free so it can be unit
 * tested without a network. The data layer (client.ts) fetches the numbers;
 * this file interprets them.
 *
 * Dew point, not relative humidity, is the honest measure of how much
 * moisture is in the air. A 30 % relative humidity at 35 °C is far muggier
 * than 30 % at 5 °C — the dew point captures that where RH does not.
 */

/** A single hour of prediction, all temperatures in degrees Celsius. */
export interface DewpointHour {
  /** ISO-8601 local time for the forecast location, e.g. "2026-07-03T14:00". */
  time: string;
  /** Air (dry-bulb) temperature, °C. */
  temperatureC: number;
  /** Dew-point temperature, °C. */
  dewpointC: number;
  /** Relative humidity, %, 0–100 (optional; some sources omit it). */
  relativeHumidity?: number;
}

/**
 * Human comfort bands keyed off dew point. These are the widely used
 * meteorological "feel" thresholds (in °C). Below ~10 °C air feels dry;
 * above ~24 °C it feels oppressive regardless of temperature.
 */
export type ComfortLevel =
  | "dry"
  | "very-comfortable"
  | "comfortable"
  | "noticeable"
  | "sticky"
  | "oppressive"
  | "miserable";

export interface ComfortBand {
  level: ComfortLevel;
  label: string;
  /** Short, plain-language description of how it feels. */
  blurb: string;
}

const COMFORT_BANDS: Array<{ maxC: number } & ComfortBand> = [
  { maxC: 10.0, level: "dry", label: "Dry", blurb: "Crisp and dry — pleasant for most people." },
  { maxC: 12.8, level: "very-comfortable", label: "Very comfortable", blurb: "Fresh air, barely a trace of humidity." },
  { maxC: 15.6, level: "comfortable", label: "Comfortable", blurb: "Humidity is present but not a bother." },
  { maxC: 18.3, level: "noticeable", label: "Noticeable", blurb: "You can feel the humidity now." },
  { maxC: 21.1, level: "sticky", label: "Sticky", blurb: "Muggy and uncomfortable; sweat won't evaporate well." },
  { maxC: 23.9, level: "oppressive", label: "Oppressive", blurb: "Heavy, oppressive air — outdoor effort is draining." },
  { maxC: Infinity, level: "miserable", label: "Miserable", blurb: "Dangerously humid; limit exertion and hydrate." },
];

/** Classify a dew point (°C) into a human comfort band. */
export function comfortForDewpoint(dewpointC: number): ComfortBand {
  const band = COMFORT_BANDS.find((b) => dewpointC < b.maxC) ?? COMFORT_BANDS[COMFORT_BANDS.length - 1];
  return { level: band.level, label: band.label, blurb: band.blurb };
}

export type RiskLevel = "none" | "low" | "moderate" | "high";

export interface RiskAssessment {
  level: RiskLevel;
  /** Why we assigned this level, in one sentence. */
  reason: string;
}

/**
 * Fog / mist likelihood from the dew-point *depression* (air temp minus dew
 * point). When the spread is tiny the air is at or near saturation, so fog
 * or mist can form — most likely overnight and around dawn when temperature
 * falls toward the dew point.
 */
export function fogRisk(hour: DewpointHour): RiskAssessment {
  const spread = hour.temperatureC - hour.dewpointC;
  if (spread <= 1.0) {
    return { level: "high", reason: `Temperature is within ${round1(spread)} °C of the dew point — air is near saturation.` };
  }
  if (spread <= 2.5) {
    return { level: "moderate", reason: `A ${round1(spread)} °C spread means mist or patchy fog is possible.` };
  }
  if (spread <= 4.0) {
    return { level: "low", reason: `A ${round1(spread)} °C spread leaves a small chance of mist in sheltered spots.` };
  }
  return { level: "none", reason: `A ${round1(spread)} °C spread keeps the air well clear of saturation.` };
}

/**
 * Condensation risk on a surface held at `surfaceTempC`. Any surface at or
 * below the dew point will collect moisture — this is why car windows fog,
 * cold drinks "sweat", and dew (or, below 0 °C, frost) settles on grass.
 *
 * Defaults to a 4 °C surface, a rough stand-in for something recently cooled
 * (a windowpane on a cool night, a drink from the fridge).
 */
export function condensationRisk(dewpointC: number, surfaceTempC = 4): RiskAssessment {
  const margin = surfaceTempC - dewpointC;
  const frost = dewpointC <= 0;
  const noun = frost ? "frost" : "condensation";
  if (margin <= 0) {
    return { level: "high", reason: `A ${round1(surfaceTempC)} °C surface is at or below the dew point — expect ${noun}.` };
  }
  if (margin <= 2) {
    return { level: "moderate", reason: `A ${round1(surfaceTempC)} °C surface is only ${round1(margin)} °C above the dew point — ${noun} is likely.` };
  }
  if (margin <= 5) {
    return { level: "low", reason: `A ${round1(surfaceTempC)} °C surface stays ${round1(margin)} °C above the dew point — light ${noun} possible.` };
  }
  return { level: "none", reason: `A ${round1(surfaceTempC)} °C surface is well above the dew point — no ${noun} expected.` };
}

/**
 * Dew point from temperature and relative humidity via the Magnus formula.
 * Handy for validating a source, or deriving dew point when only T and RH
 * are available. Accurate to a few tenths of a degree for 0–60 °C.
 */
export function dewpointFromTempHumidity(temperatureC: number, relativeHumidity: number): number {
  const b = 17.62;
  const c = 243.12; // °C
  const rh = clamp(relativeHumidity, 1, 100);
  const gamma = Math.log(rh / 100) + (b * temperatureC) / (c + temperatureC);
  return (c * gamma) / (b - gamma);
}

export interface ComfortWindow {
  start: string;
  end: string;
  /** Number of consecutive hours in the window. */
  hours: number;
  /** Highest (worst) dew point inside the window, °C. */
  peakDewpointC: number;
}

/**
 * The longest run of consecutive hours whose dew point stays at or below
 * `thresholdC` — i.e. the best stretch to be outside. Returns null if no
 * hour qualifies. Defaults to the top of the "comfortable" band (16 °C).
 */
export function bestComfortWindow(hours: DewpointHour[], thresholdC = 16): ComfortWindow | null {
  let best: DewpointHour[] = [];
  let run: DewpointHour[] = [];
  for (const h of hours) {
    if (h.dewpointC <= thresholdC) {
      run.push(h);
      if (run.length > best.length) best = run;
    } else {
      run = [];
    }
  }
  if (best.length === 0) return null;
  return {
    start: best[0].time,
    end: best[best.length - 1].time,
    hours: best.length,
    peakDewpointC: Math.max(...best.map((h) => h.dewpointC)),
  };
}

export interface DewpointInsights {
  /** The single muggiest hour in the range. */
  peak: { hour: DewpointHour; comfort: ComfortBand };
  /** The freshest (lowest dew point) hour in the range. */
  trough: { hour: DewpointHour; comfort: ComfortBand };
  /** Mean dew point across the range, °C. */
  averageDewpointC: number;
  /** Worst fog risk across the range and the hour it occurs. */
  fog: RiskAssessment & { time: string };
  /** The best contiguous comfortable window, if any. */
  comfortWindow: ComfortWindow | null;
  /** One-line human summary of the range. */
  summary: string;
}

const RISK_ORDER: Record<RiskLevel, number> = { none: 0, low: 1, moderate: 2, high: 3 };

/** Roll a range of predicted hours up into the headline insights. */
export function summarizeForecast(hours: DewpointHour[]): DewpointInsights {
  if (hours.length === 0) {
    throw new Error("summarizeForecast: no hours provided");
  }

  let peak = hours[0];
  let trough = hours[0];
  let sum = 0;
  let worstFog: RiskAssessment & { time: string } = { ...fogRisk(hours[0]), time: hours[0].time };

  for (const h of hours) {
    if (h.dewpointC > peak.dewpointC) peak = h;
    if (h.dewpointC < trough.dewpointC) trough = h;
    sum += h.dewpointC;
    const fog = fogRisk(h);
    if (RISK_ORDER[fog.level] > RISK_ORDER[worstFog.level]) {
      worstFog = { ...fog, time: h.time };
    }
  }

  const averageDewpointC = round1(sum / hours.length);
  const peakComfort = comfortForDewpoint(peak.dewpointC);
  const comfortWindow = bestComfortWindow(hours);

  const parts: string[] = [
    `Dew point peaks at ${round1(peak.dewpointC)} °C — ${peakComfort.label.toLowerCase()}.`,
  ];
  if (worstFog.level === "high" || worstFog.level === "moderate") {
    parts.push(`Fog risk is ${worstFog.level} around ${shortTime(worstFog.time)}.`);
  }
  if (comfortWindow) {
    parts.push(`Best window: ${shortTime(comfortWindow.start)}–${shortTime(comfortWindow.end)}.`);
  }

  return {
    peak: { hour: peak, comfort: peakComfort },
    trough: { hour: trough, comfort: comfortForDewpoint(trough.dewpointC) },
    averageDewpointC,
    fog: worstFog,
    comfortWindow,
    summary: parts.join(" "),
  };
}

/** °C → °F, rounded to one decimal. */
export function toFahrenheit(celsius: number): number {
  return round1(celsius * 1.8 + 32);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** "2026-07-03T14:00" -> "14:00". Falls back to the raw string. */
function shortTime(iso: string): string {
  const t = iso.split("T")[1];
  return t ? t.slice(0, 5) : iso;
}
