// Custom-scheme sign-in callback: agentplain://auth/callback?token=<raw>
// Thin wrapper over the shared exchange screen.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { TokenExchangeScreen } from "../../src/auth/token-exchange-screen";

export default function AuthCallback() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : null;
  return <TokenExchangeScreen token={token} />;
}
