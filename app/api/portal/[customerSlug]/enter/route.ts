// GET /api/portal/[customerSlug]/enter?token=… — magic-link landing.
//
// Consumes a single-use invite token, mints an end-client session, and sets the
// portal cookie on the REDIRECT response directly (response.cookies.set) so
// Next.js 14 doesn't drop Max-Age on the redirect
// (project_stay_signed_in_30day_fix). On any bad/expired/used token we redirect
// to the portal home, which explains the invite-link flow — we never reveal
// whether a token existed.

import { NextResponse } from "next/server";
import { resolveEnabledPortalBySlug } from "@/lib/portal/config";
import {
  buildPortalCookieOpts,
  consumePortalInvite,
  createPortalSession,
  portalCookieName,
} from "@/lib/portal/identity";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ customerSlug: string }> },
) {
  const { customerSlug } = await params;
  const origin = env.appPublicOrigin().replace(/\/$/, "");
  const home = `${origin}/portal/${encodeURIComponent(customerSlug)}`;

  const resolved = await resolveEnabledPortalBySlug(customerSlug);
  if (!resolved) {
    // Unknown/disabled portal — 404 page.
    return NextResponse.redirect(`${origin}/portal/${encodeURIComponent(customerSlug)}`, {
      status: 302,
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return NextResponse.redirect(`${home}?invite=missing`, { status: 302 });

  const consumed = await consumePortalInvite({
    portalConfigId: resolved.config.id,
    rawToken: token,
  });
  if (!consumed) {
    return NextResponse.redirect(`${home}?invite=expired`, { status: 302 });
  }

  const session = await createPortalSession({
    portalConfigId: resolved.config.id,
    clientId: consumed.clientId,
  });

  const res = NextResponse.redirect(home, { status: 302 });
  res.cookies.set(portalCookieName(), session.rawToken, buildPortalCookieOpts());
  return res;
}
