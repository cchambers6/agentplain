/**
 * tests/oauth-transmitted-scopes.test.ts
 *
 * THE REGRESSION THAT MATTERS. Everything else in the 2026-09-13 OAuth scope
 * change is a one-time fix; this is the check that stops the class recurring.
 *
 * The defect it exists for: `lib/integrations/marketplace.ts` declared one
 * scope set per connector, and `buildAuthorizeUrl` transmitted another. The
 * Gmail branch accepted a `scopes` argument and silently dropped it, falling
 * through to a hardcoded `gmail.readonly` default. Nothing noticed, because
 * every check in the repo -- including `checkConnectorActionScopes` -- read
 * the DECLARATION rather than the REQUEST. A catalog is only a source of
 * truth if something forces the wire to agree with it.
 *
 * So this file asserts, for every connectable OAuth tile, that the scope set
 * riding on the real authorize URL equals the scope set the catalog declares.
 * It measures by building the URL and reading the query parameter back off
 * it -- never by re-deriving what the builder ought to do.
 *
 * Per the repo's verification standard it reports `examined N of M` and fails
 * when N drops below a floor: an assertion over an empty subject set passes,
 * and a silently-emptied corpus is a failure mode this project has hit more
 * than once.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { listIntegrations, type MarketplaceEntry } from "@/lib/integrations/marketplace";
import { transmittedScopes } from "@/lib/integrations/oauth-urls";
import {
  GoogleOAuth,
  GOOGLE_ALL_SCOPES,
  GOOGLE_DRIVE_SCOPES,
  GOOGLE_GMAIL_SCOPES,
} from "@/lib/integrations/google/oauth";

/**
 * Tiles a customer can actually click Connect on and that negotiate OAuth
 * scopes. Coming-soon tiles have no connect flow to be wrong about; api-key
 * tiles do not negotiate scopes at all.
 */
function connectableOAuthTiles(): MarketplaceEntry[] {
  return listIntegrations().filter(
    (e) => e.status === "available" && e.connectMode !== "api-key",
  );
}

/**
 * The ONE declared divergence between catalog and wire.
 *
 * Notion has no granular OAuth scopes -- capability comes from the
 * integration type configured on Notion's side plus which pages the user
 * shares -- so the authorize URL carries no scope parameter and the catalog
 * array is decorative. That is a decision, recorded here so it stays one.
 * Anything NOT in this map must match exactly.
 *
 * Adding an entry here is how you knowingly accept a divergence. Do not add
 * one to make a failure go away.
 */
const TRANSMITS_NO_SCOPE_PARAM: Readonly<Record<string, string>> = {
  notion:
    "Notion does not use granular OAuth scopes; the authorize URL carries no scope parameter and the catalog array is decorative (see the notion branch of buildAuthorizeUrl).",
};

/**
 * Floor on how many tiles this file adjudicates. Measured at 12 on 2026-09-13
 * (gmail, outlook, teams, onedrive, excel, quickbooks, hubspot, docusign,
 * google-drive, slack, salesforce, notion). A floor rather than an equality
 * so adding a connector does not fail the build -- but deleting the corpus
 * does.
 */
const MIN_EXAMINED = 12;

describe("OAuth: what the catalog declares is what the wire carries", () => {
  it("every connectable OAuth tile has an authorize-URL branch", () => {
    const orphans = connectableOAuthTiles()
      .filter((e) => transmittedScopes(e) === null)
      .map((e) => e.id);
    assert.deepEqual(
      orphans,
      [],
      "These tiles are marked available and OAuth but buildAuthorizeUrl has no " +
        "branch for them, so clicking Connect throws: " +
        orphans.join(", "),
    );
  });

  it("transmitted scope set equals the declared scope set", () => {
    const tiles = connectableOAuthTiles();
    const mismatches: string[] = [];
    let examined = 0;

    for (const tile of tiles) {
      const transmitted = transmittedScopes(tile);
      if (transmitted === null) continue; // reported by the test above
      examined++;

      const declared = [...tile.scopes].sort();
      const actual = [...transmitted].sort();

      const exemption = TRANSMITS_NO_SCOPE_PARAM[tile.id];
      if (exemption !== undefined) {
        // An exemption is not a skip. Assert the divergence has the shape it
        // claims: nothing transmitted at all.
        if (actual.length !== 0) {
          mismatches.push(
            tile.id +
              " is exempted as transmitting no scope parameter, but the authorize " +
              "URL carries: " +
              actual.join(", "),
          );
        }
        continue;
      }

      if (JSON.stringify(declared) !== JSON.stringify(actual)) {
        mismatches.push(
          tile.id +
            " | declared: " +
            (declared.length > 0 ? declared.join(" ") : "(none)") +
            " | transmitted: " +
            (actual.length > 0 ? actual.join(" ") : "(none)"),
        );
      }
    }

    assert.ok(
      examined >= MIN_EXAMINED,
      "examined " +
        examined +
        " of " +
        tiles.length +
        " connectable OAuth tiles, below the floor of " +
        MIN_EXAMINED +
        ". An assertion over an empty or shrunken corpus passes and proves " +
        "nothing -- check that listIntegrations() still returns the catalog " +
        "before lowering this floor.",
    );

    assert.deepEqual(
      mismatches,
      [],
      "The marketplace catalog and the authorize URL disagree about what is " +
        "being requested. The catalog is what a reviewer, an engineer and the " +
        "consent-screen config all read; the URL is what the customer is " +
        "actually asked to grant. (examined " +
        examined +
        " of " +
        tiles.length +
        ") :: " +
        mismatches.join(" ;; "),
    );
  });

  it("KNOWN-POSITIVE CONTROL: the probe reflects the argument, not a default", () => {
    // This is the assertion that would have caught the original defect. Under
    // the pre-2026-09-13 code the Gmail branch ignored its scopes argument, so
    // this returned the hardcoded default no matter what was passed in.
    const sentinel = transmittedScopes({
      id: "gmail",
      scopes: ["https://www.googleapis.com/auth/sentinel.probe"],
    });
    assert.deepEqual(
      sentinel,
      ["https://www.googleapis.com/auth/sentinel.probe"],
      "transmittedScopes('gmail') did not echo the scopes it was handed -- the " +
        "Gmail authorize branch is discarding its argument again.",
    );
  });

  it("KNOWN-POSITIVE CONTROL: an unknown integration reports null, not []", () => {
    // [] means "transmits nothing" (Notion). null means "there is nothing to
    // measure". Collapsing the two would make an unwired tile look compliant.
    assert.equal(transmittedScopes({ id: "not-an-integration", scopes: ["x"] }), null);
  });
});

describe("Google OAuth verification submission: the requested scope set", () => {
  it("Gmail transmits exactly GOOGLE_GMAIL_SCOPES", () => {
    assert.deepEqual(
      (transmittedScopes({ id: "gmail", scopes: [...GOOGLE_GMAIL_SCOPES] }) ?? []).sort(),
      [...GOOGLE_GMAIL_SCOPES].sort(),
    );
  });

  it("Drive transmits exactly GOOGLE_DRIVE_SCOPES", () => {
    assert.deepEqual(
      (
        transmittedScopes({ id: "google-drive", scopes: [...GOOGLE_DRIVE_SCOPES] }) ?? []
      ).sort(),
      [...GOOGLE_DRIVE_SCOPES].sort(),
    );
  });

  it("requests no restricted-tier scope beyond gmail.modify", () => {
    // Google's restricted tier triggers an annual third-party security
    // assessment. gmail.modify is justified by users.drafts.create and
    // users.messages.modify (see GOOGLE_GMAIL_SCOPES). Anything else in that
    // tier has to be argued for on its own, so it fails here first and gets
    // argued for deliberately rather than arriving by accident.
    const NOT_REQUESTED = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.insert",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/gmail.settings.sharing",
      "https://mail.google.com/",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.readonly",
    ];
    for (const scope of NOT_REQUESTED) {
      assert.ok(
        !GOOGLE_ALL_SCOPES.includes(scope),
        scope +
          " is requested but is not justified by any caller named in " +
          "GOOGLE_GMAIL_SCOPES / GOOGLE_DRIVE_SCOPES. Every restricted or " +
          "broad scope enlarges the Google verification review.",
      );
    }
  });

  it("requests the narrow calendar scope, never the full calendar scope", () => {
    assert.ok(
      GOOGLE_ALL_SCOPES.includes("https://www.googleapis.com/auth/calendar.events"),
      "calendar.events is required by the Google Calendar MCP tool surface",
    );
    assert.ok(
      !GOOGLE_ALL_SCOPES.includes("https://www.googleapis.com/auth/calendar"),
      "the full calendar scope also grants calendar-list management we never call",
    );
  });

  it("GOOGLE_ALL_SCOPES is the union of every Google tile, with no extras", () => {
    // This is the list that must match the Cloud Console consent screen. If it
    // can drift from the tiles, the submission can name a scope no tile asks
    // for -- an unjustifiable scope is worse at review than a missing one.
    const fromTiles = new Set<string>();
    for (const tile of connectableOAuthTiles()) {
      if (tile.providerKey !== "GOOGLE") continue;
      for (const s of transmittedScopes(tile) ?? []) fromTiles.add(s);
    }
    assert.ok(fromTiles.size > 0, "no GOOGLE tiles examined -- check the catalog filter");
    assert.deepEqual([...fromTiles].sort(), [...GOOGLE_ALL_SCOPES].sort());
  });

  it("DELIBERATE FAILURE: buildAuthorizationUrl refuses to invent a scope set", () => {
    // The root of the whole class was a silent default. Prove it is gone: an
    // empty scope set must throw, not quietly consent to something.
    const oauth = new GoogleOAuth({ clientId: "probe", clientSecret: "probe" });
    assert.throws(
      () =>
        oauth.buildAuthorizationUrl({
          redirectUri: "https://probe.invalid/cb",
          state: "probe",
          scopes: [],
        }),
      /scopes.*required/i,
    );
  });
});
