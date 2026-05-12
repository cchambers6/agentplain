import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Logo from "@/components/brand/Logo";
import { requireUser } from "@/lib/auth/server";

// Operator surface chrome. Restricted to operators (Conner). Phase 1 is
// operator-only; customer self-serve OAuth UI lands in a follow-on PR
// per `feedback_integration_acceptance_is_functional` (PR-C functional
// demo gates anything that widens this surface).

export const metadata: Metadata = {
  title: "agentplain · operator",
  robots: { index: false, follow: false },
};

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b border-rule bg-paper">
        <div className="container-wide flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo size="sm" />
            <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              operator
            </span>
          </div>
          <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            {session.email}
          </span>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
