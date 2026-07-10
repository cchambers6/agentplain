"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { findCatalogEntry, type CatalogEntry } from "@/lib/catalog";
import { stageForBirthdate } from "@/lib/stages";
import type { OnboardingPayload } from "./schema";

// 7-step onboarding wizard (M1 success criterion: a parent completes this in
// ≤20 minutes and ends on one coherent picture of what Chiron will do).
// Steps: family → child → philosophy → school days → goals → curricula → confirm.

type CurriculumDraft = {
  name: string;
  publisher: string;
  subjects: string;
  catalogId: string | null;
  parentNotes: string;
};

const EMPTY_CURRICULUM: CurriculumDraft = {
  name: "",
  publisher: "",
  subjects: "",
  catalogId: null,
  parentNotes: "",
};

const PHILOSOPHIES = [
  {
    key: "charlotte_mason",
    label: "Charlotte Mason",
    blurb:
      "Living books, short lessons, narration, nature study. Fully supported today.",
    available: true,
  },
  {
    key: "classical_trivium",
    label: "Classical Trivium",
    blurb: "Grammar, logic, rhetoric stages. Coming in a future pack.",
    available: false,
  },
  {
    key: "circe",
    label: "CIRCE",
    blurb: "Cultivating wisdom and virtue. Coming in a future pack.",
    available: false,
  },
  {
    key: "memoria",
    label: "Memoria",
    blurb: "Latin-first systematic classical. Coming in a future pack.",
    available: false,
  },
] as const;

const WEEKDAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 7, label: "Sun" },
];

const STEPS = [
  "Family",
  "Child",
  "Philosophy",
  "School days",
  "Goals",
  "Curricula",
  "Confirm",
];

export default function OnboardWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [parentName, setParentName] = useState("");
  const [state, setState] = useState("GA");
  const [timezone, setTimezone] = useState("America/New_York");
  const [childName, setChildName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [philosophy, setPhilosophy] = useState<string>("charlotte_mason");
  const [schoolDays, setSchoolDays] = useState<number[]>([1, 2, 3, 4]);
  const [goals, setGoals] = useState("");
  const [curricula, setCurricula] = useState<CurriculumDraft[]>([
    { ...EMPTY_CURRICULUM },
    { ...EMPTY_CURRICULUM },
  ]);

  const stage = useMemo(
    () => (birthdate ? stageForBirthdate(new Date(birthdate)) : null),
    [birthdate],
  );

  const matches: (CatalogEntry | undefined)[] = useMemo(
    () => curricula.map((c) => (c.name.length >= 3 ? findCatalogEntry(c.name) : undefined)),
    [curricula],
  );

  function validate(): string | null {
    switch (step) {
      case 0:
        return parentName.trim() ? null : "Your name is required.";
      case 1:
        if (!childName.trim()) return "Child's name is required.";
        if (!birthdate || Number.isNaN(Date.parse(birthdate)))
          return "Enter a valid birthdate.";
        if (Date.parse(birthdate) >= Date.now())
          return "Birthdate must be in the past.";
        return null;
      case 3:
        return schoolDays.length ? null : "Pick at least one school day.";
      case 4:
        return goals.trim() ? null : "A sentence or two is plenty.";
      case 5: {
        const filled = curricula.filter((c) => c.name.trim());
        if (filled.length < 2) return "Enter at least two curricula.";
        for (const c of filled) {
          if (!c.subjects.trim())
            return `Add at least one subject for “${c.name.trim()}”.`;
        }
        return null;
      }
      default:
        return null;
    }
  }

  function next() {
    const v = validate();
    setError(v);
    if (!v) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload: OnboardingPayload = {
      parentName: parentName.trim(),
      state,
      timezone,
      name: childName.trim(),
      birthdate,
      philosophy: philosophy as OnboardingPayload["philosophy"],
      schoolDays,
      goals: goals.trim(),
      curricula: curricula
        .filter((c) => c.name.trim())
        .map((c, i) => ({
          name: c.name.trim(),
          publisher: c.publisher.trim() || matches[i]?.publisher || "",
          subjects: c.subjects.trim(),
          catalogId: matches[i]?.id ?? null,
          parentNotes: c.parentNotes.trim(),
        })),
    };
    const res = await fetch("/api/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/today");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong saving your setup.");
    }
  }

  function setCurriculum(i: number, patch: Partial<CurriculumDraft>) {
    setCurricula((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <ol className="mb-10 flex flex-wrap gap-2 text-xs text-walnut/70">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-3 py-1 ${
              i === step
                ? "border-walnut bg-walnut text-parchment"
                : i < step
                  ? "border-sage bg-sage/20"
                  : "border-walnut/30"
            }`}
          >
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section>
          <h1 className="font-serif text-3xl">About your family</h1>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-walnut">Your name</span>
              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="mt-1 w-full rounded-md border border-walnut/40 bg-white px-4 py-3"
                placeholder="e.g. Sarah Hartfield"
              />
            </label>
            <label className="block">
              <span className="text-sm text-walnut">State</span>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 w-full rounded-md border border-walnut/40 bg-white px-4 py-3"
              >
                <option value="GA">Georgia</option>
              </select>
              <span className="mt-1 block text-xs text-walnut/60">
                Georgia only during the proof of concept — record-keeping rules
                are state-specific.
              </span>
            </label>
            <label className="block">
              <span className="text-sm text-walnut">Timezone</span>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 w-full rounded-md border border-walnut/40 bg-white px-4 py-3"
              >
                <option value="America/New_York">Eastern (America/New_York)</option>
                <option value="America/Chicago">Central (America/Chicago)</option>
                <option value="America/Denver">Mountain (America/Denver)</option>
                <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1 className="font-serif text-3xl">Your child</h1>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-walnut">Name</span>
              <input
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                className="mt-1 w-full rounded-md border border-walnut/40 bg-white px-4 py-3"
                placeholder="e.g. Anna"
              />
            </label>
            <label className="block">
              <span className="text-sm text-walnut">Birthdate</span>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="mt-1 w-full rounded-md border border-walnut/40 bg-white px-4 py-3"
              />
            </label>
            {stage && (
              <p className="rounded-md bg-sage/20 px-4 py-3 text-sm">
                That places {childName.trim() || "your child"} in the{" "}
                <strong>{stage}</strong> stage — the years of gathering and
                delighting in facts, stories, and songs.
              </p>
            )}
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="font-serif text-3xl">Your teaching philosophy</h1>
          <p className="mt-2 text-walnut">
            Chiron plans your week the way your philosophy would.
          </p>
          <div className="mt-6 space-y-3">
            {PHILOSOPHIES.map((p) => (
              <button
                type="button"
                key={p.key}
                disabled={!p.available}
                onClick={() => setPhilosophy(p.key)}
                className={`block w-full rounded-md border px-4 py-3 text-left ${
                  philosophy === p.key
                    ? "border-walnut bg-walnut/10"
                    : "border-walnut/30 bg-white"
                } ${p.available ? "" : "opacity-50"}`}
              >
                <span className="font-serif text-lg">{p.label}</span>
                <span className="block text-sm text-walnut">{p.blurb}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h1 className="font-serif text-3xl">School days</h1>
          <p className="mt-2 text-walnut">
            Which days do you do lessons? Many families keep one weekday free.
          </p>
          <div className="mt-6 flex gap-2">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.n}
                onClick={() =>
                  setSchoolDays((days) =>
                    days.includes(d.n)
                      ? days.filter((x) => x !== d.n)
                      : [...days, d.n].sort(),
                  )
                }
                className={`h-12 w-12 rounded-md border font-serif ${
                  schoolDays.includes(d.n)
                    ? "border-walnut bg-walnut text-parchment"
                    : "border-walnut/30 bg-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <h1 className="font-serif text-3xl">Your vision</h1>
          <p className="mt-2 text-walnut">
            In your own words — what do you want{" "}
            {childName.trim() || "your child"}&apos;s education to be?
          </p>
          <textarea
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={6}
            className="mt-6 w-full rounded-md border border-walnut/40 bg-white px-4 py-3"
            placeholder="e.g. I want her to love books, spend real time outdoors, and never learn that math is something to fear…"
          />
        </section>
      )}

      {step === 5 && (
        <section>
          <h1 className="font-serif text-3xl">Your curricula</h1>
          <p className="mt-2 text-walnut">
            The materials you already own. Chiron plans around them — it never
            replaces them.
          </p>
          <div className="mt-6 space-y-8">
            {curricula.map((c, i) => (
              <fieldset key={i} className="rounded-md border border-walnut/30 bg-white p-4">
                <legend className="px-2 font-serif">Curriculum {i + 1}</legend>
                <div className="space-y-3">
                  <input
                    value={c.name}
                    onChange={(e) => setCurriculum(i, { name: e.target.value })}
                    className="w-full rounded-md border border-walnut/40 px-4 py-2"
                    placeholder="Name — e.g. Story of the World Vol. 1"
                  />
                  <input
                    value={c.publisher}
                    onChange={(e) => setCurriculum(i, { publisher: e.target.value })}
                    className="w-full rounded-md border border-walnut/40 px-4 py-2"
                    placeholder="Publisher (optional)"
                  />
                  <input
                    value={c.subjects}
                    onChange={(e) => setCurriculum(i, { subjects: e.target.value })}
                    className="w-full rounded-md border border-walnut/40 px-4 py-2"
                    placeholder="Subjects, comma-separated — e.g. history"
                  />
                  {matches[i] ? (
                    <p className="rounded-md bg-sage/20 px-3 py-2 text-sm">
                      Found it: <strong>{matches[i]!.name}</strong>
                      {matches[i]!.publisher ? ` (${matches[i]!.publisher})` : ""}.
                      We&apos;ll fill in its scope &amp; sequence automatically.
                    </p>
                  ) : c.name.trim().length >= 3 ? (
                    <div>
                      <p className="rounded-md bg-ochre/10 px-3 py-2 text-sm">
                        We don&apos;t have this one catalogued yet — help us
                        fill in: how is it structured (units, lessons, how many
                        per week)?
                      </p>
                      <textarea
                        value={c.parentNotes}
                        onChange={(e) =>
                          setCurriculum(i, { parentNotes: e.target.value })
                        }
                        rows={3}
                        className="mt-2 w-full rounded-md border border-walnut/40 px-4 py-2"
                        placeholder="e.g. 30 lessons, we do 2 a week, each takes about 20 minutes…"
                      />
                    </div>
                  ) : null}
                </div>
              </fieldset>
            ))}
            {curricula.length < 3 && (
              <button
                type="button"
                onClick={() => setCurricula((cs) => [...cs, { ...EMPTY_CURRICULUM }])}
                className="rounded-md border border-dashed border-walnut/40 px-4 py-2 text-sm text-walnut"
              >
                + Add a third
              </button>
            )}
          </div>
        </section>
      )}

      {step === 6 && (
        <section>
          <h1 className="font-serif text-3xl">Here&apos;s what Chiron will do</h1>
          <div className="mt-6 space-y-4 rounded-md border border-walnut/30 bg-white p-6 leading-relaxed">
            <p>
              <strong>{childName.trim()}</strong> ({stage} stage) learns on{" "}
              <strong>
                {WEEKDAYS.filter((d) => schoolDays.includes(d.n))
                  .map((d) => d.label)
                  .join(", ")}
              </strong>{" "}
              in the <strong>Charlotte Mason</strong> way — short, varied
              lessons; living books; narration; time outdoors.
            </p>
            <p>
              Chiron will blend{" "}
              <strong>
                {curricula
                  .filter((c) => c.name.trim())
                  .map((c) => c.name.trim())
                  .join(" + ")}
              </strong>{" "}
              into one coherent week, so you never have to reconcile three
              pacing guides at the kitchen table again.
            </p>
            <p>
              Each morning you&apos;ll get a short brief; each afternoon a
              two-minute debrief. Chiron listens, keeps a growing picture of
              how {childName.trim() || "your child"} actually learns, and
              adjusts next week accordingly.
            </p>
            <p>
              And because you&apos;re in Georgia, your attendance and
              subject-coverage records build themselves as a byproduct — ready
              when you need them.
            </p>
            <p className="border-t border-walnut/20 pt-4 text-sm text-walnut">
              Your words we&apos;ll plan by: “{goals.trim()}”
            </p>
          </div>
        </section>
      )}

      {error && <p className="mt-6 text-sm text-terracotta">{error}</p>}

      <div className="mt-10 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || busy}
          className="rounded-md border border-walnut/40 px-6 py-3 disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-walnut px-8 py-3 font-serif text-parchment hover:bg-ink"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-md bg-walnut px-8 py-3 font-serif text-parchment hover:bg-ink disabled:opacity-50"
          >
            {busy ? "Setting up…" : "Begin"}
          </button>
        )}
      </div>
    </main>
  );
}
