import Link from "next/link";
import { SignUpForm } from "./SignUpForm";

export default function SignUpPage() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-md">
        <p className="eyebrow mb-4">Create a workspace</p>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Set up your brokerage on agentplain.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Phase 1 is invite-only and onboarded by hand. Drop your details and
          a sign-in link lands in your inbox.
        </p>
        <div className="mt-8">
          <SignUpForm />
        </div>
        <p className="mt-8 text-sm text-slate-soft">
          Already have an account?{" "}
          <Link href="/app/sign-in" className="text-ink underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
