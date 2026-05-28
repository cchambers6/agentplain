// SimpleWebAuthn adapter — the ONLY file that imports @simplewebauthn/server.
// Swapping to another WebAuthn library (or a managed provider) is a new file
// implementing WebAuthnProvider + a one-line change in index.ts.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { WebAuthnConfig } from "./config";
import type {
  AuthenticationOptionsInput,
  GeneratedOptions,
  PasskeyOptionsJSON,
  RegistrationOptionsInput,
  VerifiedAuthentication,
  VerifiedRegistration,
  VerifyAuthenticationInput,
  VerifyRegistrationInput,
  WebAuthnProvider,
} from "./types";

const toBase64url = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("base64url");

// Allocate a fresh ArrayBuffer-backed view so the type matches the SDK's
// Uint8Array<ArrayBuffer> param (Buffer is backed by a shared ArrayBufferLike).
const fromBase64url = (value: string): Uint8Array<ArrayBuffer> => {
  const buf = Buffer.from(value, "base64url");
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
};

const asTransports = (
  t: string[] | undefined,
): AuthenticatorTransportFuture[] | undefined =>
  t && t.length > 0 ? (t as AuthenticatorTransportFuture[]) : undefined;

export class SimpleWebAuthnProvider implements WebAuthnProvider {
  readonly providerName = "simplewebauthn";

  constructor(private readonly config: WebAuthnConfig) {}

  async generateRegistrationOptions(
    input: RegistrationOptionsInput,
  ): Promise<GeneratedOptions> {
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userName: input.userName,
      userID: new TextEncoder().encode(input.userId),
      userDisplayName: input.userDisplayName ?? input.userName,
      attestationType: "none",
      excludeCredentials: input.existingCredentials.map((c) => ({
        id: c.credentialId,
        transports: asTransports(c.transports),
      })),
      // Resident (discoverable) keys let the user sign in with no email typed.
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
    // W3C-standard JSON; cast at the vendor boundary to the neutral seam type.
    return {
      optionsJSON: options as unknown as PasskeyOptionsJSON,
      challenge: options.challenge,
    };
  }

  async verifyRegistration(
    input: VerifyRegistrationInput,
  ): Promise<VerifiedRegistration> {
    const verification = await verifyRegistrationResponse({
      response: input.responseJSON as RegistrationResponseJSON,
      expectedChallenge: input.expectedChallenge,
      // string | string[] — pass the list so apex + www + app all verify.
      expectedOrigin: this.config.expectedOrigins,
      expectedRPID: this.config.rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return {
        verified: false,
        credentialId: "",
        publicKey: "",
        counter: 0,
        transports: [],
        deviceType: null,
        backedUp: false,
      };
    }

    const info = verification.registrationInfo;
    return {
      verified: true,
      credentialId: info.credential.id,
      publicKey: toBase64url(info.credential.publicKey),
      counter: info.credential.counter,
      transports: info.credential.transports ?? [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    };
  }

  async generateAuthenticationOptions(
    input: AuthenticationOptionsInput,
  ): Promise<GeneratedOptions> {
    const allow = input.allowCredentials ?? [];
    const options = await generateAuthenticationOptions({
      rpID: this.config.rpID,
      userVerification: "preferred",
      allowCredentials:
        allow.length > 0
          ? allow.map((c) => ({
              id: c.credentialId,
              transports: asTransports(c.transports),
            }))
          : undefined,
    });
    return {
      optionsJSON: options as unknown as PasskeyOptionsJSON,
      challenge: options.challenge,
    };
  }

  async verifyAuthentication(
    input: VerifyAuthenticationInput,
  ): Promise<VerifiedAuthentication> {
    const verification = await verifyAuthenticationResponse({
      response: input.responseJSON as AuthenticationResponseJSON,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: this.config.expectedOrigins,
      expectedRPID: this.config.rpID,
      requireUserVerification: false,
      credential: {
        id: input.credential.credentialId,
        publicKey: fromBase64url(input.credential.publicKey),
        counter: Number(input.credential.counter),
        transports: asTransports(input.credential.transports),
      },
    });

    return {
      verified: verification.verified,
      newCounter: verification.authenticationInfo?.newCounter ?? 0,
    };
  }
}
