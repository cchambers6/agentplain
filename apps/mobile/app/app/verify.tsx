// Universal-link sign-in landing: https://app.agentplain.com/app/verify?token=<raw>
//
// This is the SAME path the transactional magic-link email already points at on
// web. With the iOS associatedDomains / Android intentFilter in app.json, a tap
// on that link opens the installed app here instead of the browser. Thin
// wrapper over the shared exchange screen.

import React from "react";
import { useLocalSearchParams } from "expo-router";
import { TokenExchangeScreen } from "../../src/auth/token-exchange-screen";

export default function AppVerify() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : null;
  return <TokenExchangeScreen token={token} />;
}
