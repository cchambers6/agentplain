import Link from "next/link";
import { ApEyebrow, ApMotif } from "@/components/ui/ap";
import { SignInForm } from "./SignInForm";

type Reason = "missing" | "invalid" | "expired" | "used";

const REASON_COPY: Record<Reason, string> = {
  missing: "That sign-in link is missing its token. Request a fresh one below.",
  invalid: "That sign-in link is no longer valid. Request a fresh one below.",
  expired:
    "That sign-in link has expired. Request a fresh one below — links are good for 15 minutes.",
  used: "That sign-in link has already been used. Request a fresh one below.",
};

const isReason = (v: string | undefined): v is Reason =>
  v === "missing" || v === "invalid" || v === "expired" || v === "used";

interface SignInPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { reason } = await searchParams;
  const flash = isReason(reason) ? REASON_COPY[reason] : null;

  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-ink">
          <ApMotif name="lone-tree" size={80} />
        </div>
        <ApEyebrow className="mb-4">sign in</ApEyebrow>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Step back into your workspace.
        </h1>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-soft">
          Drop your email. We send a single-use link — no password to lose.
        </p>
        {flash ? (
          <p
            className="mt-6 border border-rule bg-paper-deep p-4 text-[15px] leading-relaxed text-ink"
            role="status"
          >
            {flash}
          </p>
        ) : null}
        <div className="mt-8">
          <SignInForm />
        </div>
        <p className="mt-10 border-t border-rule pt-6 text-sm text-mute">
          New to agentplain?{" "}
          <Link href="/app/sign-up" className="text-ink underline">
            begin with us →
          </Link>
        </p>
      </div>
    </div>
  );
}
