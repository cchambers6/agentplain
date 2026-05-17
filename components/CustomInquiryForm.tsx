"use client";

import { useState } from "react";
import {
  CUSTOM_INQUIRY_VERTICAL_OPTIONS,
  INQUIRY_TYPE_DETAIL,
  INQUIRY_TYPE_LABEL,
  INQUIRY_TYPE_OPTIONS,
  showsServiceIntensityNotes,
  type CustomInquiryInput,
  type CustomInquirySubmitResponse,
  type InquiryType,
} from "@/lib/custom-inquiry/types";

// Contact form for /custom. Per `project_no_outbound_architecture.md` the
// form posts to /api/custom-inquiry, which persists the row and emails
// Conner's inbox — no drip sequences, no auto-replies beyond the
// synchronous "got it" state below.
//
// Per `feedback_everything_tells_a_story.md` the form answers the visitor's
// final question on the page ("how do I start a conversation?"). The
// `inquiry_type` toggle (added 2026-05-15) lets a visitor self-route between
// the Custom-skill-build path and the Max-tier quote path without splitting
// the surface; "Not sure / both" stays available for visitors who haven't
// chosen yet.

const FIELD_LABEL = {
  name: "Your name",
  business: "Business name",
  vertical: "Vertical",
  seats: "Seats (estimate)",
  needs: "What you need",
  email: "Email",
  serviceIntensityNotes: "What does your operation look like?",
} as const;

// Human-readable label for each vertical option in the select. We re-derive
// the label from the slug to avoid drift if a slug gets renamed.
function verticalLabel(slug: string): string {
  if (slug === "other") return "Other / not sure yet";
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface FormState {
  name: string;
  business: string;
  vertical: CustomInquiryInput["vertical"];
  seats: string;
  needs: string;
  email: string;
  inquiryType: InquiryType;
  serviceIntensityNotes: string;
}

function initialState(defaultType: InquiryType): FormState {
  return {
    name: "",
    business: "",
    vertical: "other",
    seats: "",
    needs: "",
    email: "",
    inquiryType: defaultType,
    serviceIntensityNotes: "",
  };
}

interface Props {
  /** Pre-selected inquiry type — driven by `/custom?type=max` etc. */
  defaultInquiryType?: InquiryType;
}

export default function CustomInquiryForm({
  defaultInquiryType = "custom_skill_build",
}: Props) {
  const [state, setState] = useState<FormState>(() =>
    initialState(defaultInquiryType),
  );
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [sentType, setSentType] = useState<InquiryType>(defaultInquiryType);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((errs) => {
        const next = { ...errs };
        delete next[key];
        return next;
      });
    }
  }

  const showIntensity = showsServiceIntensityNotes(state.inquiryType);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setFormError(null);
    setFieldErrors({});

    const payload: Record<string, unknown> = {
      name: state.name,
      business: state.business,
      vertical: state.vertical,
      seats: state.seats,
      needs: state.needs,
      email: state.email,
      inquiryType: state.inquiryType,
    };
    if (showIntensity && state.serviceIntensityNotes.trim().length > 0) {
      payload.serviceIntensityNotes = state.serviceIntensityNotes;
    }

    try {
      const res = await fetch("/api/custom-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as CustomInquirySubmitResponse;
      if (json.ok) {
        setSentType(json.inquiryType);
        setStatus("sent");
        return;
      }
      setStatus("error");
      if (json.fieldErrors) setFieldErrors(json.fieldErrors);
      if (json.formError) setFormError(json.formError);
    } catch (err) {
      setStatus("error");
      setFormError(
        err instanceof Error
          ? err.message
          : "Something went wrong sending your inquiry. Email hello@agentplain.com directly.",
      );
    }
  }

  if (status === "sent") {
    return <SentState type={sentType} />;
  }

  return (
    <form
      id="custom-contact"
      onSubmit={onSubmit}
      className="border border-rule bg-paper p-6 md:p-10"
      noValidate
    >
      <p className="eyebrow mb-6">Tell us what you need</p>

      {/* Inquiry type toggle — the first decision because it changes which
          downstream fields the operator needs. Radio rather than select so
          the option detail is visible without a click. */}
      <fieldset className="mb-8">
        <legend className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          Type of inquiry
        </legend>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {INQUIRY_TYPE_OPTIONS.map((opt) => {
            const selected = state.inquiryType === opt;
            return (
              <label
                key={opt}
                className={`flex cursor-pointer flex-col border p-4 transition ${
                  selected
                    ? "border-ink bg-paper-deep"
                    : "border-rule bg-paper hover:border-ink-soft"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="inquiryType"
                    value={opt}
                    checked={selected}
                    onChange={() => update("inquiryType", opt)}
                    className="h-3.5 w-3.5 accent-ink"
                  />
                  <span className="font-mono text-[12px] uppercase tracking-eyebrow text-ink">
                    {INQUIRY_TYPE_LABEL[opt]}
                  </span>
                </span>
                <span className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                  {INQUIRY_TYPE_DETAIL[opt]}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          id="cu-name"
          label={FIELD_LABEL.name}
          value={state.name}
          onChange={(v) => update("name", v)}
          error={fieldErrors.name}
          autoComplete="name"
        />
        <TextField
          id="cu-business"
          label={FIELD_LABEL.business}
          value={state.business}
          onChange={(v) => update("business", v)}
          error={fieldErrors.business}
          autoComplete="organization"
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SelectField
          id="cu-vertical"
          label={FIELD_LABEL.vertical}
          value={state.vertical}
          onChange={(v) =>
            update("vertical", v as CustomInquiryInput["vertical"])
          }
          error={fieldErrors.vertical}
          options={CUSTOM_INQUIRY_VERTICAL_OPTIONS.map((slug) => ({
            value: slug,
            label: verticalLabel(slug),
          }))}
        />
        <TextField
          id="cu-seats"
          label={FIELD_LABEL.seats}
          value={state.seats}
          onChange={(v) => update("seats", v)}
          error={fieldErrors.seats}
          placeholder="e.g. 25 producers + 5 staff"
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor="cu-needs"
          className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
        >
          {FIELD_LABEL.needs}
        </label>
        <textarea
          id="cu-needs"
          rows={6}
          value={state.needs}
          onChange={(e) => update("needs", e.target.value)}
          placeholder="What the standard fleet doesn't do for you yet. Bespoke integration, compliance corpus, white-label, 100+ seats — anything."
          className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink focus:outline-none ${
            fieldErrors.needs
              ? "border-flag focus:border-flag"
              : "border-rule focus:border-ink"
          }`}
        />
        {fieldErrors.needs ? (
          <p className="mt-1 font-mono text-[11px] text-flag">
            {fieldErrors.needs}
          </p>
        ) : null}
      </div>

      {/* Service-intensity textarea — surfaced only when the visitor picked
          the Max path or "Not sure". For Max it's required at the API
          layer; for "Not sure" it's optional but encouraged. */}
      {showIntensity ? (
        <div className="mt-6">
          <label
            htmlFor="cu-intensity"
            className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
          >
            {FIELD_LABEL.serviceIntensityNotes}
          </label>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            Multi-state? White-label? Dedicated team? Regulated-vertical
            compliance gates? Sketch the shape — drives the scoping call.
          </p>
          <textarea
            id="cu-intensity"
            rows={5}
            value={state.serviceIntensityNotes}
            onChange={(e) => update("serviceIntensityNotes", e.target.value)}
            placeholder="We run 4 states, white-label under our parent brand, and need a HIPAA-aware compliance overlay."
            className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink focus:outline-none ${
              fieldErrors.serviceIntensityNotes
                ? "border-flag focus:border-flag"
                : "border-rule focus:border-ink"
            }`}
          />
          {fieldErrors.serviceIntensityNotes ? (
            <p className="mt-1 font-mono text-[11px] text-flag">
              {fieldErrors.serviceIntensityNotes}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 max-w-md">
        <TextField
          id="cu-email"
          label={FIELD_LABEL.email}
          value={state.email}
          onChange={(v) => update("email", v)}
          error={fieldErrors.email}
          autoComplete="email"
          type="email"
        />
      </div>

      {formError ? (
        <p className="mt-6 border-l-2 border-flag bg-paper-deep p-3 font-mono text-[12px] text-flag">
          {formError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send inquiry"}
          <span aria-hidden>→</span>
        </button>
        <p className="font-mono text-[11px] leading-relaxed text-mute">
          We email one human; no drip sequence, no auto-reply.
        </p>
      </div>
    </form>
  );
}

// Ack state varies by inquiry type. Max prospects get the 1-business-day
// SLA framing; Custom-skill / Not-sure prospects get the standard 2-day
// scoping-call window. Copy stays inside `project_no_outbound_architecture`
// — this is a UI confirmation, not an automated email.
function SentState({ type }: { type: InquiryType }) {
  const isMax = type === "max_service_engagement";
  const title = isMax
    ? "Got it. A service partner will reach out within 1 business day."
    : "Got it. We'll come back with a written spec.";
  const body = isMax
    ? "Max-tier engagements are quote-based, so the first reply is a real human — not a drip, not an auto-form. We'll come back with a scoping window and a first read on what the engagement looks like."
    : "Expect a reply within two business days from a real human, not a drip sequence. We'll come back with a scoping call invite plus a written spec covering what we'd build, how long it'd take, and what it'd cost. No surprise charges.";
  return (
    <div className="border border-rule bg-paper p-8 md:p-10">
      <p className="eyebrow mb-3 text-clay">Inquiry sent</p>
      <h3 className="font-display text-3xl leading-tight text-ink md:text-4xl">
        {title}
      </h3>
      <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        {body}
      </p>
      <p className="mt-6 font-mono text-[12px] leading-relaxed text-mute">
        If the window passes and you haven&apos;t heard from us, email{" "}
        <a href="mailto:hello@agentplain.com" className="underline">
          hello@agentplain.com
        </a>{" "}
        — the inquiry probably hit a spam filter.
      </p>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] text-ink focus:outline-none ${
          error
            ? "border-flag focus:border-flag"
            : "border-rule focus:border-ink"
        }`}
      />
      {error ? (
        <p className="mt-1 font-mono text-[11px] text-flag">{error}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] text-ink focus:outline-none ${
          error
            ? "border-flag focus:border-flag"
            : "border-rule focus:border-ink"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 font-mono text-[11px] text-flag">{error}</p>
      ) : null}
    </div>
  );
}
