import Link from "next/link";
import { ApEyebrow, ApMotif } from "@/components/ui/ap";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { TIER_ORDER, type TierName } from "@/lib/pricing/tiers";
import { PLAINO_PARTNER } from "@/lib/onboarding/service-partner";
import { SignUpForm } from "./SignUpForm";

interface SignUpPageProps {
  searchParams: Promise<{ vertical?: string; tier?: string }>;
}

// `?tier=` pre-selects the picker so deep links from /pricing and the
// billing-page upgrade CTA land on the right card. Unknown values fall
// back to Regular (the default productized tier per
// `project_stripe_both_surfaces.md`).
function resolveDefaultTier(raw: string | undefined): TierName {
  if (!raw) return "regular";
  const normalized = raw.toLowerCase();
  if (normalized === "partner") return "plus";
  if ((TIER_ORDER as readonly string[]).includes(normalized)) {
    return normalized as TierName;
  }
  return "regular";
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const raw = (params.vertical ?? "").toLowerCase();
  const defaultVerticalSlug = getVerticalContent(raw) ? raw : "real-estate";
  const defaultTier = resolveDefaultTier(params.tier);

  const verticals = getAllVerticals().map((v) => ({
    slug: v.slug,
    name: v.name,
  }));

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-ink">
          <ApMotif name="wheat" size={88} />
        </div>
        <ApEyebrow className="mb-4">begin with us</ApEyebrow>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Root your workspace on agentplain.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-soft">
          Tell us your shop and the work you do. {PLAINO_PARTNER.name}, your
          service partner, picks up your install within one business day —
          first month is on us.
        </p>
        <div className="mt-10">
          <SignUpForm
            verticals={verticals}
            defaultVerticalSlug={defaultVerticalSlug}
            defaultTier={defaultTier}
          />
        </div>
        <p className="mt-10 border-t border-rule pt-6 text-sm text-mute">
          We email you a link. No password to lose.{" "}
          <Link href="/app/sign-in" className="text-ink underline">
            already with us? sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
