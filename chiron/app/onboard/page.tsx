import { redirect } from "next/navigation";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OnboardWizard from "./wizard";

export const dynamic = "force-dynamic";

export default async function OnboardPage() {
  if (!currentParentEmail()) redirect("/login");

  // One family per install: if onboarding already ran, go to the workspace.
  const existing = await prisma.family.findFirst({ select: { id: true } });
  if (existing) redirect("/today");

  return <OnboardWizard />;
}
