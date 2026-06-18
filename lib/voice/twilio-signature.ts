/**
 * lib/voice/twilio-signature.ts
 *
 * Webhook signature validation, behind a port so the four voice receivers
 * never trust an inbound POST without proof it came from Twilio.
 *
 * TWO IMPLEMENTATIONS (per `feedback_runner_portability.md`):
 *
 *   1. `HmacTwilioSignatureVerifier` (default, dependency-free) — implements
 *      Twilio's documented X-Twilio-Signature scheme with node:crypto:
 *      HMAC-SHA1 over `URL + sortedConcat(params)`, base64, constant-time
 *      compared to the header. This keeps the whole layer buildable and
 *      testable BEFORE the `twilio` SDK is installed.
 *
 *   2. `SdkTwilioSignatureVerifier` (preferred once `twilio` is installed) —
 *      delegates to the SDK's `validateRequest`, which tracks edge cases
 *      (port handling, added params) the Twilio docs warn about. Loaded via a
 *      NON-LITERAL dynamic import so `tsc` does not require the package to be
 *      present at build time; `getTwilioSignatureVerifier()` auto-upgrades to
 *      it when the package resolves at runtime, else falls back to the HMAC
 *      verifier.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this is the ONLY place voice code
 * reaches for the `twilio` SDK, and even here it is optional + lazy.
 *
 * SECURITY: the auth token is the signing secret. It is read from env at call
 * time and never logged, returned, or placed in an error message.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { twilioAuthToken, voicePublicBaseUrl } from './config';

export interface SignatureCheckInput {
  /** The exact, fully-qualified URL Twilio signed (incl. query string). */
  url: string;
  /** Parsed application/x-www-form-urlencoded body params. */
  params: Record<string, string>;
  /** The X-Twilio-Signature header value. */
  signature: string | null;
}

/** The validation port. Implementations decide HOW; receivers only call it. */
export interface TwilioSignatureVerifier {
  verify(input: SignatureCheckInput): boolean;
}

/**
 * Build the canonical URL Twilio actually signed. Twilio signs the URL it was
 * configured with — behind a proxy/CDN the inbound `req.url` host can differ
 * from the public host, so we prefer VOICE_PUBLIC_BASE_URL when set and only
 * replace the origin, preserving the path + query Twilio appended.
 */
export function canonicalWebhookUrl(reqUrl: string): string {
  const base = voicePublicBaseUrl();
  if (!base) return reqUrl;
  try {
    const incoming = new URL(reqUrl);
    const publicBase = new URL(base);
    incoming.protocol = publicBase.protocol;
    incoming.host = publicBase.host;
    return incoming.toString();
  } catch {
    return reqUrl;
  }
}

/**
 * Twilio's documented form-encoded scheme. Returns the base64 HMAC-SHA1 of
 * `url + key1value1 + key2value2 + …` with keys sorted ascending.
 */
function computeExpectedSignature(authToken: string, input: SignatureCheckInput): string {
  const data = Object.keys(input.params)
    .sort()
    .reduce((acc, key) => acc + key + input.params[key], input.url);
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}

/** Constant-time string compare that tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf-8');
  const bb = Buffer.from(b, 'utf-8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export class HmacTwilioSignatureVerifier implements TwilioSignatureVerifier {
  constructor(private readonly authToken: string) {}

  verify(input: SignatureCheckInput): boolean {
    if (!input.signature) return false;
    const expected = computeExpectedSignature(this.authToken, input);
    return safeEqual(expected, input.signature);
  }
}

/**
 * SDK-backed verifier. Constructed only when `twilio` resolves. The minimal
 * surface we use (`validateRequest`) is typed locally so we depend on no
 * `@types/twilio`.
 */
interface TwilioSdkLike {
  validateRequest(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean;
}

export class SdkTwilioSignatureVerifier implements TwilioSignatureVerifier {
  constructor(
    private readonly sdk: TwilioSdkLike,
    private readonly authToken: string,
  ) {}

  verify(input: SignatureCheckInput): boolean {
    if (!input.signature) return false;
    return this.sdk.validateRequest(this.authToken, input.signature, input.url, input.params);
  }
}

/**
 * A verifier that always rejects. Returned when no auth token is configured —
 * fail-closed: with no secret we cannot prove provenance, so we refuse rather
 * than wave traffic through. The receivers translate this into a 503/401.
 */
export class RejectAllSignatureVerifier implements TwilioSignatureVerifier {
  verify(_input: SignatureCheckInput): boolean {
    return false;
  }
}

/**
 * Resolve the best available verifier for the current env. Prefers the SDK
 * when installed (non-literal import so the build never requires it), else the
 * dependency-free HMAC verifier, else fail-closed.
 */
export async function getTwilioSignatureVerifier(): Promise<TwilioSignatureVerifier> {
  const token = twilioAuthToken();
  if (!token) return new RejectAllSignatureVerifier();

  // Non-literal specifier → tsc does not resolve/require the module at build.
  const pkg = 'twilio';
  try {
    const mod = (await import(/* @vite-ignore */ pkg)) as unknown as Partial<TwilioSdkLike> & {
      default?: Partial<TwilioSdkLike>;
    };
    const validate = mod.validateRequest ?? mod.default?.validateRequest;
    if (typeof validate === 'function') {
      return new SdkTwilioSignatureVerifier({ validateRequest: validate } as TwilioSdkLike, token);
    }
  } catch {
    // `twilio` not installed yet — expected pre-provisioning. Fall through.
  }
  return new HmacTwilioSignatureVerifier(token);
}
