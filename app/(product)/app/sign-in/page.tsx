import Link from "next/link";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <div className="container-wide py-16">
      <div className="mx-auto max-w-md">
        <p className="eyebrow mb-4">Sign in</p>
        <h1 className="font-display text-4xl leading-tight text-ink">
          Sign in to your workspace.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          Drop your email — we'll send a single-use link.
        </p>
        <div className="mt-8">
          <SignInForm />
        </div>
        <p className="mt-8 text-sm text-mute">
          New to agentplain?{" "}
          <Link href="/app/sign-up" className="text-ink underline">
            Create a workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
