// Ambient declaration for the OPTIONAL `@vercel/blob` package so the portal
// storage adapter (lib/portal/storage.ts) typechecks and builds WITHOUT the
// package installed. The real package is only loaded at runtime, via a
// webpackIgnore'd dynamic import, and only when PORTAL_STORAGE=blob. Until an
// operator runs `npm i @vercel/blob` and sets BLOB_READ_WRITE_TOKEN, the portal
// uses the dependency-free `ref` adapter and this declaration is never exercised
// at runtime. See docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md.
declare module "@vercel/blob" {
  export interface PutBlobResult {
    url: string;
    downloadUrl: string;
    pathname: string;
    contentType: string;
    contentDisposition: string;
  }
  export interface PutCommandOptions {
    access: "public";
    token?: string;
    contentType?: string;
    addRandomSuffix?: boolean;
  }
  export function put(
    pathname: string,
    body: ArrayBuffer | Buffer | Blob | Uint8Array | string,
    options: PutCommandOptions,
  ): Promise<PutBlobResult>;
}
