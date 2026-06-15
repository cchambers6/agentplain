import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

// The workspace index now redirects to /today — the J1 landing surface in the
// 5-tab IA (workspace-ia-simplification-2026-06-14). The former Overview body
// moved to ./today/page.tsx so the default landing highlights the Today tab.
export default async function WorkspaceIndexPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/app/workspace/${id}/today`);
}
