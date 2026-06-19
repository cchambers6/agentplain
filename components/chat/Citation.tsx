"use client";

/**
 * components/chat/Citation.tsx
 *
 * Renders the source citations behind a Plaino answer. Each retrieved
 * grounding chunk (lib/knowledge) carries a title, an optional legal
 * citation (e.g. "O.C.G.A. § 43-40-8"), a jurisdiction, and a canonical
 * source URL. A `<Citation>` shows a compact, mono "cited" chip; clicking
 * it opens a modal with the full citation, jurisdiction, the grounded
 * excerpt, and a link out to the public source — so a customer can verify
 * exactly what Plaino's legal/tax/regulatory answer was grounded in.
 *
 * Trust, not decoration: a grounded answer the customer can trace to
 * O.C.G.A. or an IRS publication is the whole point of the corpus. The
 * component degrades gracefully — title-only when there's no citation/url
 * (e.g. a SKILL or CUSTOMER snippet), full source link when there is.
 *
 * Pure presentation, no data fetching. SSR-safe: the closed state renders
 * deterministically (renderToStaticMarkup in tests).
 */

import { useEffect, useId, useState } from "react";

export interface CitationSource {
  /** Question-shaped snippet title. Always present. */
  title: string;
  /** Legal/authority citation, e.g. "O.C.G.A. § 43-40-8" or
   *  "IRS Publication 463". Null for non-corpus snippets. */
  citation?: string | null;
  /** Jurisdiction code, e.g. "GA" or "US". Null = jurisdiction-agnostic. */
  jurisdiction?: string | null;
  /** Canonical public source URL. Null when there's no linkable source. */
  sourceUrl?: string | null;
  /** The grounded excerpt shown in the modal. Optional. */
  body?: string | null;
  /** Cosine similarity 0..1, shown as a faint relevance hint. Optional. */
  similarity?: number | null;
}

const MAX_MODAL_BODY = 1200;

/** A single citation chip + its source modal. */
export function Citation({ source }: { source: CitationSource }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  // Esc closes; lock nothing else (lightweight, no focus-trap dependency).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = source.citation ?? source.title;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-ink underline-offset-4 hover:underline focus:underline focus:outline-none"
        title={`Source: ${label}`}
      >
        {label}
        {source.jurisdiction ? (
          <span className="ml-1 text-ink-soft">({source.jurisdiction})</span>
        ) : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border border-rule bg-paper p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  id={titleId}
                  className="text-sm font-medium text-ink"
                >
                  {source.title}
                </p>
                {source.citation ? (
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-ink-soft">
                    {source.citation}
                    {source.jurisdiction ? ` · ${source.jurisdiction}` : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close source"
                className="shrink-0 text-mute hover:text-ink focus:text-ink focus:outline-none"
              >
                ✕
              </button>
            </div>

            {source.body ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                {source.body.length > MAX_MODAL_BODY
                  ? `${source.body.slice(0, MAX_MODAL_BODY)}…`
                  : source.body}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-rule pt-3">
              {source.sourceUrl ? (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ink underline underline-offset-4 hover:no-underline"
                >
                  View public source →
                </a>
              ) : (
                <span className="text-sm text-mute">No linkable source</span>
              )}
              {typeof source.similarity === "number" ? (
                <span className="font-mono text-[11px] text-mute">
                  match {Math.round(Math.max(0, Math.min(1, source.similarity)) * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Renders a `cited:` row of `<Citation>` chips. Returns null when empty so
 *  callers can drop it in unconditionally. */
export function CitationList({ sources }: { sources: CitationSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
      <span className="text-ink-soft">cited:</span>{" "}
      {sources.map((s, i) => (
        <span key={`${s.title}-${i}`}>
          {i > 0 ? ", " : ""}
          <Citation source={s} />
        </span>
      ))}
    </div>
  );
}
