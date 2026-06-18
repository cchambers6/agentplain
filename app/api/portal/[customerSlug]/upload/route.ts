// POST /api/portal/[customerSlug]/upload — end-client document upload.
//
// Client-gated: only a signed-in end client of THIS portal may upload, and the
// document is scoped to their portal (+ optional case). The bytes go to the
// storage adapter, then through the virus scanner; the document is recorded
// PENDING and only released (CLEAN) when a real scanner clears durably-stored
// bytes (lib/portal/documents.ts — fail-closed).

import { NextResponse } from "next/server";
import { getPortalContext } from "@/lib/portal/server";
import {
  PortalUploadError,
  ingestPortalUpload,
} from "@/lib/portal/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ customerSlug: string }> },
) {
  const { customerSlug } = await params;
  const ctx = await getPortalContext(customerSlug);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Portal not found." }, { status: 404 });
  }
  if (!ctx.signedIn) {
    return NextResponse.json(
      { ok: false, error: "Your session has expired — open your portal link again." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  const caseId = typeof form.get("caseId") === "string" ? (form.get("caseId") as string) : null;

  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const result = await ingestPortalUpload({
      portalConfigId: ctx.brand.portalConfigId,
      clientId: ctx.signedIn.clientId,
      caseId: caseId || null,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      data,
      uploadedBy: "CLIENT",
    });
    return NextResponse.json(
      { ok: true, scanStatus: result.scanStatus, documentId: result.document.id },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof PortalUploadError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error("[portal] upload failed", err);
    return NextResponse.json(
      { ok: false, error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
