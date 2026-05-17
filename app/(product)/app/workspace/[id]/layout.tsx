import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";
import { signOutAction } from "../../actions";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const NAV: Array<{ href: string; label: string }> = [
  { href: "", label: "Overview" },
  { href: "/agents", label: "Agents" },
  { href: "/approvals", label: "Approvals" },
  { href: "/compliance", label: "Compliance" },
  { href: "/briefings", label: "Briefings" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
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
      <div className="border-b border-rule bg-paper-deep">
        <div className="container-wide flex flex-col gap-3 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              {workspace.slug}
            </p>
            <p className="font-display text-2xl text-ink">{workspace.name}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono tracking-wide uppercase text-mute">
            <span>{member.email}</span>
            <span aria-hidden>·</span>
            <span>{member.role.replace("_", " ").toLowerCase()}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-mute underline-offset-4 hover:text-ink hover:underline"
              >
                sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="container-wide flex gap-5 overflow-x-auto pb-3 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={`${base}${item.href}`}
              className="whitespace-nowrap text-ink/70 transition hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="container-wide py-10">{children}</div>
    </div>
  );
}
