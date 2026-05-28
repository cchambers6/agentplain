import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";
import { ApWorkspaceStrip } from "@/components/ui/ap";
import { signOutAction } from "../../actions";
import { WorkspaceNavLink } from "./WorkspaceNavLink";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const NAV: Array<{ href: string; label: string }> = [
  { href: "", label: "Overview" },
  { href: "/talk", label: "Talk to Plaino" },
  { href: "/disciplines", label: "Disciplines" },
  { href: "/fleet", label: "Fleet" },
  { href: "/activity", label: "Activity" },
  { href: "/approvals", label: "Approvals" },
  { href: "/agents", label: "Agents" },
  { href: "/compliance", label: "Compliance" },
  { href: "/briefings", label: "Briefings" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
];

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = await params;
  const member = await requireWorkspaceMember(id, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({ where: { id }, select: { id: true, name: true, slug: true } }),
  );
  if (!workspace) {
    // Shouldn't happen — requireWorkspaceMember already redirects on miss.
    return null;
  }

  const base = `/app/workspace/${id}`;

  return (
    <div>
      <a href="#workspace-main" className="skip-to-content">
        skip to content
      </a>
      <ApWorkspaceStrip
        slug={workspace.slug}
        name={workspace.name}
        right={
          <>
            <span>{member.email}</span>
            <span aria-hidden>·</span>
            <span>{member.role.replace("_", " ").toLowerCase()}</span>
            {member.isOperator ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href="/operator/leadership-board"
                  className="text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                >
                  operator
                </Link>
              </>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
              >
                sign out
              </button>
            </form>
          </>
        }
        nav={NAV.map((item) => (
          <WorkspaceNavLink
            key={item.label}
            href={`${base}${item.href}`}
            exact={item.href === ""}
          >
            {item.label}
          </WorkspaceNavLink>
        ))}
      />
      {/* tabIndex=-1 so the skip-to-content anchor moves focus here without
          adding a permanent tab stop. <section> not <main> because
          ApAppShell already wraps children in a single <main>. */}
      <section
        id="workspace-main"
        tabIndex={-1}
        aria-label="workspace content"
        className="container-wide py-10 focus:outline-none"
      >
        {children}
      </section>
    </div>
  );
}
