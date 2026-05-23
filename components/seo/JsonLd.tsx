// Typed JSON-LD injector — emits a single <script type="application/ld+json">
// per call with the payload JSON-stringified safely.
//
// Why a tiny component and not a layout-level metadata helper:
// - The `next/script` tag with id-based dedupe is the Next.js-recommended way
//   to ship structured data (App Router supports `<Script type="application/ld+json">`),
//   but Server Components can render plain <script> tags inline. This component
//   stays a Server Component so we don't ship any client JS for SEO.
// - Per `feedback_no_silent_vendor_lock.md`, this is a small adapter over the
//   schema.org vocabulary — no third-party SDK. The shape lives in `lib/seo/`.
//
// `data` is JSON-stringified once; we do not need React's JSON-encoded children
// (which would HTML-escape quotes inside the body). The standard escape for
// JSON-LD-in-HTML is to replace `</` with `<\/` so a literal `</script>` inside
// the payload can't terminate the script tag early — done here.

type JsonLdPayload = Record<string, unknown> | Array<Record<string, unknown>>;

export default function JsonLd({ data, id }: { data: JsonLdPayload; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
