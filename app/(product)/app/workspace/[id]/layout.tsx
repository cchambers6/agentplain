import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";
import { ApWorkspaceStrip } from "@/components/ui/ap";
import { signOutAction } from "../../actions";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const NAV: Array<{ href: string; label: string }> = [
  { href: "", label: "Overview" },
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
      <ApWorkspaceStrip
        slug={workspace.slug}
        name={workspace.name}
        right={
          <>
            <span>{member.email}</span>
            <span aria-hidden>·</span>
            <span>{member.role.replace("_", " ").toLowerCase()}</span>
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
          <Link
            key={item.label}
            href={`${base}${item.href}`}
            className="whitespace-nowrap rounded-none text-ink/70 transition hover:text-ink focus:outline-none focus-visible:text-ink focus-visible:underline focus-visible:underline-offset-4"
          >
            {item.label}
          </Link>
        ))}
      />
      <div className="container-wide py-10">{children}</div>
    </div>
  );
}
