// Virus-scan fail-closed contract. A document is only ever CLEAN when a real
// scanner positively clears it; every other path quarantines.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ClamAvRestScanner,
  interpretClamAvResponse,
  getPortalScanner,
  __setPortalScannerForTests,
} from "@/lib/portal/virus-scan";

describe("interpretClamAvResponse", () => {
  it("maps clean verdicts", () => {
    assert.equal(interpretClamAvResponse("OK").verdict, "CLEAN");
    assert.equal(interpretClamAvResponse('{"Status":"OK"}').verdict, "CLEAN");
    assert.equal(interpretClamAvResponse("Everything ok - no threats").verdict, "CLEAN");
  });

  it("maps infected verdicts", () => {
    assert.equal(interpretClamAvResponse("FOUND Eicar-Test-Signature").verdict, "INFECTED");
    assert.equal(
      interpretClamAvResponse('{"Status":"FOUND","Description":"Eicar"}').verdict,
      "INFECTED",
    );
  });

  it("treats anything unrecognized as ERROR (never CLEAN)", () => {
    assert.equal(interpretClamAvResponse("¯\\_(ツ)_/¯").verdict, "ERROR");
    assert.equal(interpretClamAvResponse("").verdict, "ERROR");
  });
});

describe("ClamAvRestScanner", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("returns CLEAN when the endpoint says clean", async () => {
    const scanner = new ClamAvRestScanner("http://scan.local", (async () =>
      new Response("OK", { status: 200 })) as unknown as typeof fetch);
    const result = await scanner.scan({ filename: "a.pdf", contentType: "application/pdf", data: bytes });
    assert.equal(result.verdict, "CLEAN");
  });

  it("returns INFECTED on a FOUND response", async () => {
    const scanner = new ClamAvRestScanner("http://scan.local", (async () =>
      new Response("FOUND Win.Test", { status: 200 })) as unknown as typeof fetch);
    const result = await scanner.scan({ filename: "a.exe", contentType: "application/octet-stream", data: bytes });
    assert.equal(result.verdict, "INFECTED");
  });

  it("returns ERROR on a non-2xx response (fail-closed)", async () => {
    const scanner = new ClamAvRestScanner("http://scan.local", (async () =>
      new Response("nope", { status: 503 })) as unknown as typeof fetch);
    const result = await scanner.scan({ filename: "a.pdf", contentType: "application/pdf", data: bytes });
    assert.equal(result.verdict, "ERROR");
  });

  it("returns ERROR when the request throws (fail-closed)", async () => {
    const scanner = new ClamAvRestScanner("http://scan.local", (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch);
    const result = await scanner.scan({ filename: "a.pdf", contentType: "application/pdf", data: bytes });
    assert.equal(result.verdict, "ERROR");
  });
});

describe("getPortalScanner default", () => {
  it("is null by default — no scanner means documents stay PENDING (quarantined)", () => {
    __setPortalScannerForTests(undefined); // reset cache
    const scanner = getPortalScanner();
    assert.equal(scanner, null);
  });
});
