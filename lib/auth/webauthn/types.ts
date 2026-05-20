// WebAuthn provider abstraction.
//
// Per feedback_no_silent_vendor_lock + feedback_runner_portability: every
// vendor SDK call lives behind a lib/<domain>/ interface, and a new provider
// is a new adapter behind THIS interface — never scattered direct calls. The
// only file that imports `@simplewebauthn/server` is the adapter
// (simplewebauthn-provider.ts). Routes + UI speak this neutral shape.
//
// The option JSON payloads are W3C-standard WebAuthn JSON (the browser's
// navigator.credentials shapes), not a vendor format — but to keep the seam
// from importing the vendor's type aliases we treat them as opaque,
// JSON-serializable objects. The browser client re-types them at its own
// boundary via @simplewebauthn/browser.

/** Opaque, JSON-serializable options object handed to the browser. */
export type PasskeyOptionsJSON = Record<string, unknown>;

/** A stored credential reference, used for exclude/allow lists. */
export interface StoredCredentialRef {
  /** Base64URL credential id. */
  credentialId: string;
  transports?: string[];
}

export interface RegistrationOptionsInput {
  userId: string;
  /** Username shown to the authenticator (we use the email). */
  userName: string;
  userDisplayName?: string | null;
  /** Existing credentials so the same authenticator can't double-register. */
  existingCredentials: StoredCredentialRef[];
}

export interface AuthenticationOptionsInput {
  /**
   * When omitted/empty the flow asks for a discoverable credential — the
   * authenticator offers whatever passkey it holds for this RP, so the user
   * never types an email. Pass a list to scope a re-auth to known credentials.
   */
  allowCredentials?: StoredCredentialRef[];
}

export interface GeneratedOptions {
  optionsJSON: PasskeyOptionsJSON;
  /** Base64URL challenge — persist between options and verify, check on verify. */
  challenge: string;
}

export interface VerifyRegistrationInput {
  /** The RegistrationResponseJSON from the browser, as parsed JSON. */
  responseJSON: unknown;
  expectedChallenge: string;
}

export interface VerifiedRegistration {
  verified: boolean;
  /** Base64URL credential id. Empty string when !verified. */
  credentialId: string;
  /** Base64URL COSE public key. Empty string when !verified. */
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean;
}

export interface StoredCredentialForAuth {
  /** Base64URL credential id. */
  credentialId: string;
  /** Base64URL COSE public key. */
  publicKey: string;
  counter: number | bigint;
  transports?: string[];
}

export interface VerifyAuthenticationInput {
  /** The AuthenticationResponseJSON from the browser, as parsed JSON. */
  responseJSON: unknown;
  expectedChallenge: string;
  credential: StoredCredentialForAuth;
}

export interface VerifiedAuthentication {
  verified: boolean;
  /** Updated signature counter to persist as the replay watermark. */
  newCounter: number;
}

export interface WebAuthnProvider {
  readonly providerName: string;
  generateRegistrationOptions(
    input: RegistrationOptionsInput,
  ): Promise<GeneratedOptions>;
  verifyRegistration(
    input: VerifyRegistrationInput,
  ): Promise<VerifiedRegistration>;
  generateAuthenticationOptions(
    input: AuthenticationOptionsInput,
  ): Promise<GeneratedOptions>;
  verifyAuthentication(
    input: VerifyAuthenticationInput,
  ): Promise<VerifiedAuthentication>;
}
