// Boot gate. Reads auth state and redirects:
//   loading                       → spinner
//   signed out                    → /sign-in
//   signed in, no active workspace → /select-workspace
//   signed in, active workspace    → /(tabs)
//
// The auth provider validates any stored token on mount (calls /me), so by the
// time status leaves "loading" the redirect target is correct.

import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../src/auth/auth-context";
import { Loading } from "../src/ui";

export default function Index() {
  const { status, activeWorkspaceId } = useAuth();

  if (status === "loading") return <Loading label="Loading your workspace…" />;
  if (status === "signedOut") return <Redirect href="/sign-in" />;
  if (!activeWorkspaceId) return <Redirect href="/select-workspace" />;
  return <Redirect href="/(tabs)" />;
}
