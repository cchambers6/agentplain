/**
 * lib/portal/storage.ts
 *
 * Document storage behind a PORT (feedback_runner_portability + feedback_no_
 * silent_vendor_lock). Two implementations:
 *
 *   - RefStorage (default, NO account): records a content-addressed ref URL and
 *     stores nothing externally. Lets the whole portal upload → scan → record
 *     pipeline run end-to-end in dev / preview / CI and on prod before a blob
 *     account is wired — the document row lands, the scan stays PENDING (fail-
 *     closed), and nothing is downloadable until both a real store and a real
 *     scanner are configured.
 *   - VercelBlobStorage: PUTs the bytes to Vercel Blob. The `@vercel/blob`
 *     package is OPTIONAL — loaded only at runtime via a webpackIgnore'd
 *     dynamic import, so the bundle builds without it. Selected only when
 *     PORTAL_STORAGE=blob AND BLOB_READ_WRITE_TOKEN is set.
 *
 * CONNER ACTION to enable real uploads: `npm i @vercel/blob`, set
 * BLOB_READ_WRITE_TOKEN, set PORTAL_STORAGE=blob. See TODOS-FOR-CONNER.md.
 */

import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export interface StoredObject {
  /** Addressable URL of the stored object. */
  url: string;
  /** True when the bytes were persisted to a real external store; false for the
   *  ref adapter (which records a placeholder ref only). Downstream code uses
   *  this to keep ref-only documents from ever being offered for download. */
  durable: boolean;
}

export interface PutObjectArgs {
  /** Logical path within the portal, e.g. `portal/<slug>/<caseId>/<file>`. */
  pathname: string;
  contentType: string;
  data: Uint8Array;
}

export interface PortalStorage {
  readonly name: string;
  put(args: PutObjectArgs): Promise<StoredObject>;
}

/** No-account default. Computes a stable content hash and returns a ref URL;
 *  persists nothing externally. `durable:false` keeps ref docs non-downloadable. */
export class RefStorage implements PortalStorage {
  readonly name = "ref";
  async put(args: PutObjectArgs): Promise<StoredObject> {
    const digest = createHash("sha256").update(args.data).digest("hex").slice(0, 32);
    return {
      url: `ref://portal/${args.pathname}#${digest}`,
      durable: false,
    };
  }
}

/** Vercel Blob adapter. Loads `@vercel/blob` lazily so the package stays
 *  optional at build time. */
export class VercelBlobStorage implements PortalStorage {
  readonly name = "vercel-blob";
  constructor(private readonly token: string) {}

  async put(args: PutObjectArgs): Promise<StoredObject> {
    // webpackIgnore keeps the bundler from hard-requiring an optional package;
    // resolved at runtime in the Node serverless function only when this
    // adapter is actually selected.
    const blob = await import(/* webpackIgnore: true */ "@vercel/blob");
    const result = await blob.put(args.pathname, args.data, {
      access: "public",
      token: this.token,
      contentType: args.contentType,
      addRandomSuffix: true,
    });
    return { url: result.url, durable: true };
  }
}

let cached: PortalStorage | null = null;

/**
 * Factory. Returns the Vercel Blob adapter only when explicitly selected AND
 * the token is present; otherwise the ref adapter. Never throws on a missing
 * blob token — it degrades to ref so the upload path still records the document
 * (PENDING scan) rather than 500-ing.
 */
export function getPortalStorage(): PortalStorage {
  if (cached) return cached;
  if (env.portalStorageProvider() === "blob") {
    const token = env.portalBlobToken();
    if (token) {
      cached = new VercelBlobStorage(token);
      return cached;
    }
    // Selected but unconfigured — fall back to ref (honest degraded posture,
    // mirrors the LLM/web-search providers' fallback discipline).
    console.warn(
      "[portal] PORTAL_STORAGE=blob but BLOB_READ_WRITE_TOKEN is unset — falling back to ref storage.",
    );
  }
  cached = new RefStorage();
  return cached;
}

export function __setPortalStorageForTests(s: PortalStorage | null): void {
  cached = s;
}
