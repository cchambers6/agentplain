"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Client actions for /plan: draft/redraft the week, answer Chiron's
// surfaced choices. Chiron voice throughout; no tier/vendor language.

export function DraftWeekButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agents/integrator", { method: "POST" });
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong — please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button
        onClick={draft}
        disabled={busy}
        className="rounded-md bg-walnut px-6 py-3 font-serif text-lg text-parchment transition-colors hover:bg-ink disabled:opacity-60"
      >
        {busy ? "Drafting your week…" : label}
      </button>
      {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
    </div>
  );
}

export function ResetSeededWeekButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    await fetch("/api/plan/reset", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <button
      onClick={reset}
      disabled={busy}
      className="rounded border border-walnut/40 px-3 py-1.5 text-xs text-walnut transition-colors hover:bg-walnut/10 disabled:opacity-60"
      title="Dev only — regenerates this week from the saved integration map"
    >
      {busy ? "Resetting…" : "Reset seeded week"}
    </button>
  );
}

export interface ChoiceItem {
  /** Exact item text — the write-back key. */
  item: string;
  prompt: string;
  optionA: string;
  optionB: string;
  /** "a" | "b" when Chiron recommends one; labels get a "my pick" badge. */
  recommendation?: "a" | "b";
  rationale?: string;
  decided?: string;
}

export function PlanChoices({ choices }: { choices: ChoiceItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, string>>({});

  async function decide(item: string, decision: string) {
    setPending(item);
    const res = await fetch("/api/plan/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ item, decision }),
    });
    if (res.ok) {
      setDecided((d) => ({ ...d, [item]: decision }));
      router.refresh();
    }
    setPending(null);
  }

  return (
    <ul className="space-y-4">
      {choices.map((c) => {
        const answer = decided[c.item] ?? c.decided;
        return (
          <li key={c.item} className="rounded-lg border border-walnut/25 bg-white/40 p-4">
            <p className="font-medium">{c.prompt}</p>
            {c.rationale && (
              <p className="mt-2 text-sm leading-relaxed text-walnut">{c.rationale}</p>
            )}
            {answer ? (
              <p className="mt-3 text-sm text-sage">
                Noted — {answer === "a" ? c.optionA : answer === "b" ? c.optionB : answer}.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["a", "b"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => decide(c.item, key)}
                    disabled={pending === c.item}
                    className={`rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-60 ${
                      c.recommendation === key
                        ? "border-walnut bg-walnut text-parchment hover:bg-ink"
                        : "border-walnut/40 text-ink hover:bg-walnut/10"
                    }`}
                  >
                    {key === "a" ? c.optionA : c.optionB}
                    {c.recommendation === key && (
                      <span className="ml-2 text-xs opacity-80">my pick</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
