"use client";

// Client-side explorer for the dew-point feature. Owns the search box, calls
// GET /api/dewpoint, and renders the interpreted result. All the meaning
// (comfort bands, fog/condensation risk, comfort window) is computed
// server-side in lib/dewpoint and returned in `insights`; this component only
// re-derives per-hour comfort labels for the table, reusing the same pure
// helpers so the UI and API never disagree.

import { useState, type FormEvent } from "react";
import {
  comfortForDewpoint,
  fogRisk,
  condensationRisk,
  toFahrenheit,
  type DewpointHour,
  type DewpointInsights,
  type ResolvedLocation,
  type RiskLevel,
} from "@/lib/dewpoint";

interface ForecastResponse {
  location: ResolvedLocation;
  hours: DewpointHour[];
  insights: DewpointInsights;
}

const RISK_STYLES: Record<RiskLevel, string> = {
  none: "bg-emerald-100 text-emerald-900",
  low: "bg-lime-100 text-lime-900",
  moderate: "bg-amber-100 text-amber-900",
  high: "bg-rose-100 text-rose-900",
};

export function DewpointExplorer() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ForecastResponse | null>(null);

  async function search(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dewpoint?q=${encodeURIComponent(trimmed)}&days=2`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Something went wrong.");
        setData(null);
      } else {
        setData(body as ForecastResponse);
      }
    } catch {
      setError("Could not reach the forecast service.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void search(query);
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city — e.g. Denver, Tokyo, Paris"
          aria-label="Place name"
          className="w-full rounded-md border border-ink/20 bg-white px-4 py-2.5 text-ink outline-none focus:border-ink/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition-opacity disabled:opacity-50"
        >
          {loading ? "Finding…" : "Find dew point"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-ink/60">
        <span>Try:</span>
        {["Denver", "New Orleans", "Reykjavik", "Singapore"].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setQuery(c);
              void search(c);
            }}
            className="underline hover:text-ink"
          >
            {c}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </p>
      )}

      {data && <Result data={data} />}
    </div>
  );
}

function Result({ data }: { data: ForecastResponse }) {
  const { location, hours, insights } = data;
  const peakComfort = insights.peak.comfort;

  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl">{location.name}</h2>
      <p className="mt-1 text-sm text-ink/60">Times shown in {location.timezone}.</p>

      <p className="mt-4 rounded-lg border border-ink/10 bg-white p-4 text-ink/90">{insights.summary}</p>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Peak dew point"
          value={`${fmt(insights.peak.hour.dewpointC)} °C`}
          sub={`${fmt(toFahrenheit(insights.peak.hour.dewpointC))} °F — ${peakComfort.label}`}
        />
        <Stat
          label="Freshest"
          value={`${fmt(insights.trough.hour.dewpointC)} °C`}
          sub={`${fmt(toFahrenheit(insights.trough.hour.dewpointC))} °F — ${insights.trough.comfort.label}`}
        />
        <Stat label="Average" value={`${fmt(insights.averageDewpointC)} °C`} sub={`${fmt(toFahrenheit(insights.averageDewpointC))} °F`} />
      </div>

      {insights.comfortWindow && (
        <p className="mt-4 text-sm text-ink/80">
          <span className="font-medium">Most comfortable window:</span>{" "}
          {shortTime(insights.comfortWindow.start)}–{shortTime(insights.comfortWindow.end)} (
          {insights.comfortWindow.hours}h, peaking at {fmt(insights.comfortWindow.peakDewpointC)} °C).
        </p>
      )}

      <h3 className="mt-8 font-display text-lg">Next hours</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink/15 text-left text-ink/60">
              <th className="py-2 pr-3 font-medium">Time</th>
              <th className="py-2 pr-3 font-medium">Temp</th>
              <th className="py-2 pr-3 font-medium">Dew pt</th>
              <th className="py-2 pr-3 font-medium">Feels</th>
              <th className="py-2 pr-3 font-medium">Fog</th>
              <th className="py-2 pr-3 font-medium">Window sweat</th>
            </tr>
          </thead>
          <tbody>
            {hours.slice(0, 24).map((h) => {
              const comfort = comfortForDewpoint(h.dewpointC);
              const fog = fogRisk(h);
              // Condensation on a cool ~8 °C windowpane — a relatable "will it sweat" check.
              const sweat = condensationRisk(h.dewpointC, 8);
              return (
                <tr key={h.time} className="border-b border-ink/5">
                  <td className="py-1.5 pr-3 tabular-nums">{shortTime(h.time)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{fmt(h.temperatureC)}°</td>
                  <td className="py-1.5 pr-3 font-medium tabular-nums">{fmt(h.dewpointC)}°</td>
                  <td className="py-1.5 pr-3">{comfort.label}</td>
                  <td className="py-1.5 pr-3">
                    <Pill level={fog.level} />
                  </td>
                  <td className="py-1.5 pr-3">
                    <Pill level={sweat.level} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <p className="text-xs uppercase tracking-eyebrow text-ink/50">{label}</p>
      <p className="mt-1 text-2xl font-display tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink/60">{sub}</p>}
    </div>
  );
}

function Pill({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${RISK_STYLES[level]}`}>
      {level}
    </span>
  );
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function shortTime(iso: string): string {
  const [date, time] = iso.split("T");
  if (!time) return iso;
  const day = date?.slice(5); // MM-DD
  return `${day} ${time.slice(0, 5)}`;
}
