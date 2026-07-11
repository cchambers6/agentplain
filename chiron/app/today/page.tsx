import Link from "next/link";
import { redirect } from "next/navigation";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TodayChat from "./chat";

export const dynamic = "force-dynamic";

// The daily surface: morning brief + debrief chat. M1 ships the chat shell
// wired to the SSE endpoint; M2/M3 wire the Tutor-Advisor behind it.
export default async function TodayPage() {
  if (!currentParentEmail()) redirect("/login");

  const family = await prisma.family.findFirst({
    include: { children: true, curricula: true },
  });
  if (!family) redirect("/onboard");

  const child = family.children[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <header className="border-b border-walnut/20 pb-6">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-3xl">
            Today with {child?.name ?? "your child"}
          </h1>
          <Link
            href="/plan"
            className="text-sm text-walnut underline-offset-4 hover:underline"
          >
            This week&rsquo;s plan
          </Link>
        </div>
        <p className="mt-2 text-walnut">
          {family.curricula.map((c) => c.name).join(" · ")}
        </p>
      </header>
      <TodayChat childName={child?.name ?? "your child"} />
    </main>
  );
}
