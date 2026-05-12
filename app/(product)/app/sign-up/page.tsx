import Link from "next/link";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { SignUpForm } from "./SignUpForm";

interface SignUpPageProps {
  searchParams: Promise<{ vertical?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const raw = (params.vertical ?? "").toLowerCase();
  // Marketing pages link with the slug; if the value matches a known vertical
  // we pre-select it. Otherwise default to real-estate (Pin 1).
  const defaultVerticalSlug = getVerticalContent(raw) ? raw : "real-estate";

  // Server-rendered list keeps the marketing content bundle out of the
  // client. The form only needs {slug, name}.
  const verticals = getAllVerticals().map((v) => ({
    slug: v.slug,
    name: v.name,
  }));

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-md">
        <p className="eyebrow mb-4">Create a workspace</p>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Set up your workspace on agentplain.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Pick your vertical, name your firm, and we'll send a sign-in link.
          First month is on us — card on file kicks in at month two.
        </p>
        <div className="mt-8">
          <SignUpForm
            verticals={verticals}
            defaultVerticalSlug={defaultVerticalSlug}
          />
        </div>
        <p className="mt-8 text-sm text-mute">
          Already have an account?{" "}
          <Link href="/app/sign-in" className="text-ink underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
