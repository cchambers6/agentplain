"use client";

import { useState } from "react";

// Founding-list email capture. Posts to the existing /api/leads/capture
// endpoint (lib/leads) — the SAME durable LeadCapture row the Plaino widget
// writes, surfaced on /operator/leads. No new model, no migration.
//
// HONESTY (load-bearing): per project_no_outbound_architecture.md and the
// lead-capture route's own contract, there is NO auto-reply and NO drip. A
// real person follows up from the operator leads queue. So this surface does
// NOT promise an automated weekly newsletter (the subscribe-page material's
// "first email on its way" / "one email a week" cadence is a send we don't
// wire today). It promises exactly what we do: capture the email, a person
// reaches out, occasional notes sent by hand. Leave any time.
//
// The line-of-work dropdown maps to the locked vertical slugs so the operator
// can route the lead; "Something else" is captured as a free-form value that's
// wider than the enum (the schema's vertical column is a free string).

const LINES_OF_WORK: Array<{ value: string; label: string }> = [
  { value: "", label: "Your line of work (optional)" },
  { value: "real-estate", label: "Real estate" },
  { value: "cpa", label: "Accounting / CPA" },
  { value: "law", label: "Law" },
  { value: "home-services", label: "Home services / trades" },
  { value: "ria", label: "Financial advice" },
  { value: "other", label: "Something else" },
];

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return (
      <div className="border border-moss/40 bg-paper p-7 md:p-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-eyebrow text-moss">
          You&apos;re on the list
        </p>
        <p className="text-[15px] leading-relaxed text-ink">
          Thanks — we&apos;ve got your details. When we open in your line of
          work, a real person reaches out. No drip, no spam, and you can leave
          any time.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
          vertical: vertical || undefined,
          intent: "Joined the founding list from /waitlist.",
          sourcePage: "/waitlist",
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        formError?: string;
        fieldErrors?: Record<string, string>;
      };
      if (json.ok) {
        setStatus("sent");
        return;
      }
      setStatus("error");
      setError(
        json.fieldErrors?.email ??
          json.formError ??
          "We couldn't save that — check the email and try again.",
      );
    } catch {
      setStatus("error");
      setError("We couldn't save that — try again shortly.");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 border border-rule bg-paper p-7 md:p-8"
    >
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Email address
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          autoComplete="email"
          className="mt-2 w-full border border-rule bg-paper px-3 py-2.5 text-[15px] text-ink focus:border-ink focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          First name (optional)
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="given-name"
          className="mt-2 w-full border border-rule bg-paper px-3 py-2.5 text-[15px] text-ink focus:border-ink focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Line of work (optional)
        </span>
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="mt-2 w-full border border-rule bg-paper px-3 py-2.5 text-[15px] text-ink focus:border-ink focus:outline-none"
        >
          {LINES_OF_WORK.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="font-mono text-[12px] text-flag">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
      >
        {status === "sending" ? "Saving…" : "Join the list"}
      </button>
      <p className="text-[12px] leading-relaxed text-mute">
        We use your email to follow up about agentplain and nothing else. No
        drip sequence, no spam, no selling your address. Leave any time.
      </p>
    </form>
  );
}
