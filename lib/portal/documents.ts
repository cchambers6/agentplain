/**
 * lib/portal/documents.ts
 *
 * The upload pipeline: validate → store bytes → record a PENDING document →
 * scan → fail-closed update. A document is marked CLEAN (and therefore
 * downloadable, see lib/portal/clients.ts) ONLY when BOTH a real scanner
 * returns CLEAN AND the bytes were persisted to a durable store. Any other
 * outcome — no scanner, ref-only storage, INFECTED, ERROR — leaves the document
 * quarantined.
 */

import type { PortalDocument, PortalScanStatus } from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";
import { getPortalStorage } from "./storage";
import { getPortalScanner } from "./virus-scan";

/** 25 MB ceiling — generous for client docs, bounded against abuse. */
export const PORTAL_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Allow-list of content types a client may upload. Conservative on purpose. */
export const PORTAL_ALLOWED_CONTENT_TYPES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/heic",
  "image/webp",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

export type UploadErrorCode = "TOO_LARGE" | "EMPTY" | "UNSUPPORTED_TYPE" | "BAD_FILENAME";

export class PortalUploadError extends Error {
  readonly code: UploadErrorCode;
  constructor(code: UploadErrorCode, message: string) {
    super(message);
    this.name = "PortalUploadError";
    this.code = code;
  }
}

export interface IngestUploadArgs {
  portalConfigId: string;
  clientId?: string | null;
  caseId?: string | null;
  filename: string;
  contentType: string;
  data: Uint8Array;
  uploadedBy: "CLIENT" | "OWNER";
}

export interface IngestUploadResult {
  document: PortalDocument;
  scanStatus: PortalScanStatus;
}

/** Collapse anything outside a safe allow-list to "_", strip leading dots
 *  (no traversal), and bound length. */
export function sanitizeFilename(raw: string): string {
  const base = raw.replace(/[^A-Za-z0-9._-]+/g, "_").trim();
  const cleaned = base.replace(/^\.+/, "").slice(0, 200);
  return cleaned.length > 0 ? cleaned : "upload";
}

export async function ingestPortalUpload(
  args: IngestUploadArgs,
): Promise<IngestUploadResult> {
  if (args.data.byteLength === 0) {
    throw new PortalUploadError("EMPTY", "The file is empty.");
  }
  if (args.data.byteLength > PORTAL_MAX_UPLOAD_BYTES) {
    throw new PortalUploadError(
      "TOO_LARGE",
      `The file is larger than the ${Math.floor(PORTAL_MAX_UPLOAD_BYTES / (1024 * 1024))} MB limit.`,
    );
  }
  if (!PORTAL_ALLOWED_CONTENT_TYPES.has(args.contentType)) {
    throw new PortalUploadError(
      "UNSUPPORTED_TYPE",
      `Files of type ${args.contentType} aren't accepted here.`,
    );
  }
  const filename = sanitizeFilename(args.filename);
  if (!filename) throw new PortalUploadError("BAD_FILENAME", "Invalid file name.");

  const storage = getPortalStorage();
  const pathname = `portal/${args.portalConfigId}/${args.caseId ?? "unfiled"}/${filename}`;
  const stored = await storage.put({
    pathname,
    contentType: args.contentType,
    data: args.data,
  });

  // 1. Record the document PENDING (quarantined) BEFORE scanning, so a crash
  //    mid-scan never loses the upload and never leaves a CLEAN row unscanned.
  const created = await withSystemContext((tx) =>
    tx.portalDocument.create({
      data: {
        portalConfigId: args.portalConfigId,
        clientId: args.clientId ?? null,
        caseId: args.caseId ?? null,
        filename,
        contentType: args.contentType,
        sizeBytes: args.data.byteLength,
        blobUrl: stored.url,
        scanStatus: "PENDING",
        uploadedBy: args.uploadedBy,
      },
    }),
  );

  // 2. Scan. The verdict only earns CLEAN when the bytes are also durably
  //    stored — a ref-only object has no real download URL, so surfacing it as
  //    CLEAN would hand the client a broken link.
  const { status, detail, scannedAt } = await resolveScanOutcome({
    durable: stored.durable,
    filename,
    contentType: args.contentType,
    data: args.data,
  });

  const document = await withSystemContext((tx) =>
    tx.portalDocument.update({
      where: { id: created.id },
      data: { scanStatus: status, scanDetail: detail ?? null, scannedAt },
    }),
  );

  return { document, scanStatus: status };
}

async function resolveScanOutcome(args: {
  durable: boolean;
  filename: string;
  contentType: string;
  data: Uint8Array;
}): Promise<{ status: PortalScanStatus; detail?: string; scannedAt: Date | null }> {
  const scanner = getPortalScanner();
  if (!scanner) {
    return {
      status: "PENDING",
      detail: "Stored and quarantined — no virus scanner is configured yet, so it isn't downloadable.",
      scannedAt: null,
    };
  }
  const result = await scanner.scan({
    filename: args.filename,
    contentType: args.contentType,
    data: args.data,
  });
  if (result.verdict === "INFECTED") {
    return { status: "INFECTED", detail: result.detail ?? "Malware detected.", scannedAt: new Date() };
  }
  if (result.verdict === "ERROR") {
    return { status: "ERROR", detail: result.detail ?? "The scan could not complete.", scannedAt: new Date() };
  }
  // CLEAN — but only release it if the bytes are durably stored.
  if (!args.durable) {
    return {
      status: "PENDING",
      detail: "Scan clean, but storage is ref-only (set PORTAL_STORAGE=blob to make it downloadable).",
      scannedAt: new Date(),
    };
  }
  return { status: "CLEAN", detail: undefined, scannedAt: new Date() };
}
