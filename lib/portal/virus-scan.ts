/**
 * lib/portal/virus-scan.ts
 *
 * Virus scanning behind a PORT. FAIL-CLOSED is the whole point: an uploaded
 * document is PENDING at rest and is NEVER offered to anyone for download until
 * a scanner positively marks it CLEAN. There is no "default allow."
 *
 *   - getPortalScanner() returns null when no scanner is configured (the
 *     default). A null scanner means documents.ts leaves the row PENDING — the
 *     file is stored but quarantined, downloadable by no one. Safe by default.
 *   - ClamAvRestScanner POSTs the bytes to a ClamAV REST endpoint
 *     (PORTAL_CLAMAV_URL) and maps the verdict to CLEAN / INFECTED / ERROR.
 *
 * CONNER ACTION to enable scanning: stand up a ClamAV REST worker (self-hosted,
 * free OSS — e.g. clamav-rest on Fly.io/Render), set PORTAL_CLAMAV_URL, and set
 * PORTAL_VIRUS_SCAN=clamav. See TODOS-FOR-CONNER.md.
 */

import { env } from "@/lib/env";

/** A scanner only ever returns a terminal verdict — never PENDING (PENDING is
 *  the pre-scan DB state). ERROR keeps the file quarantined (fail-closed). */
export type ScanVerdict = "CLEAN" | "INFECTED" | "ERROR";

export interface ScanResult {
  verdict: ScanVerdict;
  detail?: string;
}

export interface VirusScanArgs {
  filename: string;
  contentType: string;
  data: Uint8Array;
}

export interface VirusScanner {
  readonly name: string;
  scan(args: VirusScanArgs): Promise<ScanResult>;
}

/**
 * ClamAV REST scanner. Posts the raw bytes and interprets the response. The
 * common community ClamAV REST images (clamav-rest, clamav-rest-api) answer
 * either with JSON `{ "Status": "OK"|"FOUND", ... }` or plain text containing
 * "OK"/"clean" vs "FOUND"/"infected". This parser handles both and treats
 * anything it can't classify as ERROR (quarantine), never CLEAN.
 */
export class ClamAvRestScanner implements VirusScanner {
  readonly name = "clamav-rest";
  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async scan(args: VirusScanArgs): Promise<ScanResult> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url, {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        // Copy into a standalone ArrayBuffer — a Uint8Array view satisfies
        // BodyInit across both the DOM and undici fetch typings.
        body: args.data.slice().buffer,
      });
    } catch (err) {
      return {
        verdict: "ERROR",
        detail: `scan request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!res.ok) {
      return { verdict: "ERROR", detail: `scanner returned HTTP ${res.status}` };
    }
    const text = (await res.text()).trim();
    return interpretClamAvResponse(text);
  }
}

/** Pure verdict mapper — exported for unit testing. */
export function interpretClamAvResponse(raw: string): ScanResult {
  const lower = raw.toLowerCase();
  // Try JSON first.
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const status = String(parsed.Status ?? parsed.status ?? "").toLowerCase();
    if (status === "ok" || status === "clean") return { verdict: "CLEAN" };
    if (status === "found" || status === "infected") {
      const virus = parsed.Description ?? parsed.virus ?? parsed.Virus;
      return { verdict: "INFECTED", detail: virus ? String(virus) : "infected" };
    }
  } catch {
    // not JSON — fall through to text heuristics
  }
  if (/\bfound\b|infected|virus|malware/.test(lower)) {
    return { verdict: "INFECTED", detail: raw.slice(0, 200) };
  }
  if (/\bok\b|clean|no threats?/.test(lower)) {
    return { verdict: "CLEAN" };
  }
  return { verdict: "ERROR", detail: `unrecognized scanner response: ${raw.slice(0, 120)}` };
}

let cached: VirusScanner | null | undefined;

/**
 * Returns the configured scanner, or null when none is configured (the safe
 * default — documents stay PENDING / quarantined). Never throws.
 */
export function getPortalScanner(): VirusScanner | null {
  if (cached !== undefined) return cached;
  if (env.portalVirusScanProvider() === "clamav") {
    const url = env.portalVirusScanUrl();
    if (url) {
      cached = new ClamAvRestScanner(url);
      return cached;
    }
    console.warn(
      "[portal] PORTAL_VIRUS_SCAN=clamav but PORTAL_CLAMAV_URL is unset — uploads will stay PENDING (quarantined).",
    );
  }
  cached = null;
  return cached;
}

export function __setPortalScannerForTests(s: VirusScanner | null | undefined): void {
  cached = s;
}
