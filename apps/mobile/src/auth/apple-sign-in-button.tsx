// Sign in with Apple button.
//
// App Review §4.8 requires an app that offers a third-party/email sign-in
// (our magic link) to ALSO offer Sign in with Apple. This wraps the native
// AppleAuthentication flow: the device returns a signed identity token, which
// the auth context exchanges for the same sealed session the magic link
// produces (one identity, multiple doors). Magic link stays the default; this
// renders only where Apple auth is available (iOS 13+).

import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "./auth-context";
import { Caption } from "../ui";
import { colors, radius, space } from "../theme";

export function AppleSignInButton() {
  const router = useRouter();
  const { signInWithApple } = useAuth();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!available) return null;

  const onPress = async () => {
    setError(null);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) {
        setError("Apple didn't return a sign-in token. Try again.");
        return;
      }
      await signInWithApple({
        identityToken: cred.identityToken,
        fullName: cred.fullName
          ? {
              givenName: cred.fullName.givenName,
              familyName: cred.fullName.familyName,
            }
          : undefined,
      });
      router.replace("/");
    } catch (e) {
      // User-cancelled is not an error worth surfacing.
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't sign in with Apple. Try a magic link instead.",
      );
    }
  };

  return (
    <View>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        buttonStyle={
          AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={radius.md}
        style={{ height: 50, width: "100%" }}
        onPress={onPress}
      />
      {error ? (
        <Caption style={{ color: colors.danger, marginTop: space.md }}>
          {error}
        </Caption>
      ) : null}
    </View>
  );
}
