// FAQ content + the FAQItem type now live in the PURE data module
// `components/faq-items.ts` so server-side code (the customer-support-triage
// KB loader, the SEO structured-data builder) can import them without
// dragging React/JSX into its bundle. Re-exported here so every existing
// `@/components/FAQ` import — the marketing pages — keeps working
// unchanged. Editorial rules + source-of-truth notes live in that module.
export { FAQ_ITEMS, pricingFaqItems } from "./faq-items";
export type { FAQItem } from "./faq-items";

import { FAQ_ITEMS, type FAQItem } from "./faq-items";

/** Reusable disclosure-list renderer so /pricing and the homepage share UI. */
export function FaqList({ items: list }: { items: FAQItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-x-10 md:gap-y-8">
      {list.map((item) => (
        <details
          key={item.q}
          className="group border-b border-rule py-5"
        >
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6">
            <span className="font-display text-xl leading-snug text-ink md:text-2xl">
              {item.q}
            </span>
            <span
              aria-hidden
              className="font-mono text-xl text-mute transition group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}

export default function FAQ() {
  return <FaqList items={FAQ_ITEMS} />;
}
