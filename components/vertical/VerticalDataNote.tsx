import Link from "next/link";

/**
 * Per-vertical data-confidentiality note. Rendered on a vertical landing page
 * when its content file sets `dataNote` — the verticals whose clients care most
 * about confidentiality (CPAs about client records, lawyers about privilege,
 * property managers about tenant PII). Optional by design: a vertical with no
 * specific concern renders nothing rather than generic filler.
 *
 * Pure presentational Server Component. Brand tokens only.
 */
export function VerticalDataNote({
  name,
  note,
}: {
  name: string;
  note: string;
}) {
  return (
    <section className="border-b border-rule bg-paper-deep">
      <div className="container-wide py-16 md:py-20">
        <p className="eyebrow mb-3">Your clients&rsquo; data</p>
        <h2 className="max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl">
          Built for the confidentiality {name.toLowerCase()} owe their clients.
        </h2>
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-ink-soft md:text-lg">
          {note}
        </p>
        <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-ink-soft">
          Your clients&rsquo; records stay in your tools — Plaino reads them
          in-flight while he&rsquo;s working and never copies them onto our
          servers. What he keeps is his memory of how your practice runs — your
          preferences, your voice, the patterns he&rsquo;s learned — so he gets
          better the longer you work together. That memory is yours: export it
          anytime, and it&rsquo;s hard-deleted when you close your account. We
          never train on your data, pool it across firms, or sell it.{" "}
          <Link href="/data" className="text-ink underline underline-offset-2">
            See exactly what we store and why →
          </Link>
        </p>
      </div>
    </section>
  );
}
