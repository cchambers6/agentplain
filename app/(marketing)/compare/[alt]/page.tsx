import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { COMPARISON_SLUGS, getComparison } from "@/lib/marketing/comparisons";
import ComparisonView from "@/components/marketing/ComparisonView";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, faqPageJsonLd } from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";

// Static generation for every comparison. Adding one is a new entry in
// `lib/marketing/comparisons.ts` — the route, sitemap, and hub pick it up.
export function generateStaticParams() {
  return COMPARISON_SLUGS.map((alt) => ({ alt }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ alt: string }>;
}): Promise<Metadata> {
  const { alt } = await params;
  const c = getComparison(alt);
  if (!c) return { title: "Not found" };
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: alternatesFor(`/compare/${c.slug}`),
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ alt: string }>;
}) {
  const { alt } = await params;
  const c = getComparison(alt);
  if (!c) notFound();

  return (
    <>
      {/* Breadcrumb: Home → Compare → {alternative}. FAQPage mirrors the
          visible FAQ list rendered by ComparisonView. */}
      <JsonLd
        id={`ld-compare-breadcrumb-${c.slug}`}
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Compare", path: "/compare" },
          { name: c.navLabel, path: `/compare/${c.slug}` },
        ])}
      />
      <JsonLd id={`ld-compare-faq-${c.slug}`} data={faqPageJsonLd(c.faq)} />
      <ComparisonView c={c} />
    </>
  );
}
