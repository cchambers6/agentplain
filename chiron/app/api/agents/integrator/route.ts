import { NextResponse } from "next/server";
import { currentParentEmail } from "@/lib/auth";

// On-demand Integrator run (fires at onboarding completion and on
// curriculum changes). M1 ships the seam; M2 implements the run.
export async function POST() {
  if (!currentParentEmail()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "integrator run not implemented until M2" },
    { status: 501 },
  );
}
