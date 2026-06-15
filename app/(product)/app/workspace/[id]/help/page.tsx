import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
  // `?subject=` arrives from the onboarding "I'm stuck" links; forward it so
  // the support intake can still prefill where the customer is stuck.
  searchParams: Promise<{ subject?: string }>;
}

// Legacy /help is the dead predecessor of /support/new — it used a separate,
// untracked data model (SupportRequest). The 5-tab IA collapses every "get a
// human" door into one. This route now permanently redirects to the support
// intake so old onboarding deep links never 404.
// (workspace-ia-simplification-2026-06-14, Section D.)
export default async function HelpPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const subject = typeof sp.subject === "string" ? sp.subject.slice(0, 200) : "";
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  redirect(`/app/workspace/${id}/support/new${query}`);
}
