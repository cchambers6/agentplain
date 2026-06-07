import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Logo from "@/components/brand/Logo";
import { requireUser } from "@/lib/auth/server";

// Internal operator console nav. These pages cross-linked each other ad hoc
// but the surface had no cohesive entry point — an operator could only reach
// a page by typing its URL. The strip makes the whole console navigable from
// anywhere inside it; the entry point into the console lives on the workspace
// strip (operators only) in app/(product)/app/workspace/[id]/layout.tsx.
const OPERATOR_NAV: Array<{ href: string; label: string }> = [
  { href: "/operator/leadership-board", label: "Leadership" },
  { href: "/operator/fleet", label: "Fleet" },
  { href: "/operator/fleet/media", label: "Media" },
  { href: "/operator/creative-briefs", label: "Creative briefs" },
  { href: "/operator/workspaces", label: "Workspaces" },
  { href: "/operator/inquiries", label: "Inquiries" },
  { href: "/operator/leads", label: "Leads" },
  { href: "/operator/support", label: "Support" },
  { href: "/operator/integrations", label: "Integrations" },
];

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
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="font-mono text-[11px] tracking-eyebrow uppercase text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
            >
              ← app
            </Link>
            <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              {session.email}
            </span>
          </div>
        </div>
        <nav
          className="container-wide flex gap-5 overflow-x-auto pb-3 text-sm scrollbar-thin"
          aria-label="operator sections"
        >
          {OPERATOR_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-ink/70 transition hover:text-ink focus:outline-none focus-visible:text-ink focus-visible:underline focus-visible:underline-offset-4"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
