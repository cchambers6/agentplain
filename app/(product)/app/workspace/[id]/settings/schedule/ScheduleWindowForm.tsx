"use client";

/**
 * ScheduleWindowForm — sets a single per-skill window. Posts to the
 * server action; on success the workspace's stored window for that
 * skill is upserted (one row per workspace × skill).
 */

import { useState } from "react";
import { setSkillScheduleWindow } from "./actions";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

interface SkillOption {
  slug: string;
  name: string;
}

interface Props {
  workspaceId: string;
  /** Skills the workspace has access to — the installed catalog. */
  skillOptions: SkillOption[];
  /** Existing windows keyed by skillSlug so the form pre-populates. */
  existingWindows: Record<
    string,
    {
      daysOfWeek: number[];
      startHourLocal: number;
      endHourLocal: number;
      workspaceTimezone: string;
    }
  >;
  /** Common IANA timezone seed. */
  defaultTimezone: string;
}

export function ScheduleWindowForm({
  workspaceId,
  skillOptions,
  existingWindows,
  defaultTimezone,
}: Props): JSX.Element {
  const [skillSlug, setSkillSlug] = useState<string>(
    skillOptions[0]?.slug ?? "",
  );
  const existing = existingWindows[skillSlug];
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existing?.daysOfWeek ?? [1, 2, 3, 4, 5],
  );
  const [startHourLocal, setStartHourLocal] = useState<number>(
    existing?.startHourLocal ?? 9,
  );
  const [endHourLocal, setEndHourLocal] = useState<number>(
    existing?.endHourLocal ?? 17,
  );
  const [workspaceTimezone, setWorkspaceTimezone] = useState<string>(
    existing?.workspaceTimezone ?? defaultTimezone,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handle = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const result = await setSkillScheduleWindow({
      workspaceId,
      skillSlug,
      daysOfWeek,
      startHourLocal,
      endHourLocal,
      workspaceTimezone,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Save failed.");
      return;
    }
    setSaved(true);
  };

  // When the skill changes, refresh the form to that skill's existing
  // window (or defaults).
  const onSkillChange = (next: string): void => {
    setSkillSlug(next);
    const w = existingWindows[next];
    setDaysOfWeek(w?.daysOfWeek ?? [1, 2, 3, 4, 5]);
    setStartHourLocal(w?.startHourLocal ?? 9);
    setEndHourLocal(w?.endHourLocal ?? 17);
    setWorkspaceTimezone(w?.workspaceTimezone ?? defaultTimezone);
    setSaved(false);
    setError(null);
  };

  return (
    <form className="space-y-4" onSubmit={handle}>
      <label className="block">
        <span className="font-mono text-[11px] uppercase text-mute">skill</span>
        <select
          required
          value={skillSlug}
          onChange={(e) => onSkillChange(e.target.value)}
          className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
        >
          {skillOptions.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name} ({s.slug})
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="font-mono text-[11px] uppercase text-mute">
          fire on
        </legend>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {DAYS.map((d) => {
            const checked = daysOfWeek.includes(d.value);
            return (
              <label
                key={d.value}
                className="flex flex-col items-center gap-1 text-[12px] text-ink"
              >
                <span className="font-mono text-[10px] uppercase text-mute">
                  {d.label}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDaysOfWeek([...daysOfWeek, d.value].sort());
                    } else {
                      setDaysOfWeek(daysOfWeek.filter((x) => x !== d.value));
                    }
                  }}
                />
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[12px] text-mute">
          Leave all days unchecked to fire on every day of the week.
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="font-mono text-[11px] uppercase text-mute">
            from hour
          </span>
          <input
            type="number"
            required
            min={0}
            max={23}
            value={startHourLocal}
            onChange={(e) => setStartHourLocal(Number(e.target.value))}
            className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] uppercase text-mute">
            until hour (exclusive)
          </span>
          <input
            type="number"
            required
            min={0}
            max={23}
            value={endHourLocal}
            onChange={(e) => setEndHourLocal(Number(e.target.value))}
            className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] uppercase text-mute">
            timezone (IANA)
          </span>
          <input
            type="text"
            required
            value={workspaceTimezone}
            onChange={(e) => setWorkspaceTimezone(e.target.value)}
            placeholder="America/New_York"
            className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
          />
        </label>
      </div>
      <p className="text-[12px] text-mute">
        If from-hour ≥ until-hour, the window is treated as overnight
        (e.g. 22 → 6 means 10pm through 6am).
      </p>

      {error ? (
        <p className="text-[13px] text-flag" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-[13px] text-moss" role="status">
          Window saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="border border-ink px-4 py-2 font-mono text-[12px] uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {submitting ? "saving…" : "save window"}
      </button>
    </form>
  );
}
