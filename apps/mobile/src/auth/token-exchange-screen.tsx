// Shared token-exchange screen, rendered by both deep-link entry points:
//   - app/auth/callback.tsx     ← custom scheme  agentplain://auth/callback?token=
//   - app/app/verify.tsx        ← universal link https://app.agentplain.com/app/verify?token=
//
// Both carry the same raw magic-link token; both exchange it for a sealed
// session and land the user in the app. Kept in one place so the two routes
// can't drift.

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "./auth-context";
import { Body, Caption, Centered, Loading } from "../ui";
import { space } from "../theme";

export function TokenExchangeScreen({ token }: { token: string | null }) {
  const router = useRouter();
  const { signInWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      router.replace("/sign-in");
      return;
    }
    (async () => {
      try {
        await signInWithToken(token, true);
        router.replace("/");
      } catch {
        setError("That sign-in link is invalid or expired.");
      }
    })();
  }, [token, router, signInWithToken]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => router.replace("/sign-in"), 1500);
    return () => clearTimeout(t);
  }, [error, router]);

  if (error) {
    return (
      <Centered>
        <Body>{error}</Body>
        <Caption style={{ marginTop: space.md }}>Returning to sign-in…</Caption>
      </Centered>
    );
  }
  return <Loading label="Signing you in…" />;
}
