// Sign-in screen (magic link).
//
// Requests a magic link for the entered email. The backend always answers 200
// (anti-enumeration), so the UI shows the same "check your email" state either
// way. Two ways back in:
//   1. The email's link deep-links to agentplain://auth/callback?token=… which
//      lands on app/auth/callback.tsx and exchanges automatically. NOTE: the
//      transactional email currently emits the WEB verify link; emitting the
//      app deep link (universal link → /app/verify, or the custom scheme) is a
//      tracked follow-up.
//   2. Dev affordance: paste the raw token to exchange manually (used until the
//      email deep link is wired). Hidden behind a disclosure to stay out of the
//      way for normal users.

import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/auth-context";
import { api, ApiError } from "../src/api";
import { Body, Button, Caption, Eyebrow, H1 } from "../src/ui";
import { colors, radius, space } from "../src/theme";

export default function SignIn() {
  const router = useRouter();
  const { signInWithToken } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTokenEntry, setShowTokenEntry] = useState(false);
  const [rawToken, setRawToken] = useState("");

  const sendLink = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await api.sendMagicLink(trimmed, true);
      setSent(true);
    } catch {
      // sendMagicLink is anti-enumeration; a thrown error here is a transport
      // failure, not an account signal.
      setError("Couldn't reach agentplain. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const exchange = async () => {
    setError(null);
    if (rawToken.trim().length < 16) {
      setError("That doesn't look like a valid sign-in token.");
      return;
    }
    setBusy(true);
    try {
      await signInWithToken(rawToken.trim(), true);
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sign-in failed. Request a fresh link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.body}>
          <Eyebrow>agentplain</Eyebrow>
          <H1 style={{ marginTop: space.sm }}>Sign in</H1>
          <Body soft style={{ marginTop: space.sm }}>
            Intelligence rooted in reality. Enter your email and we&apos;ll send a
            secure sign-in link.
          </Body>

          {!sent ? (
            <View style={{ marginTop: space.xl }}>
              <TextInput
                style={styles.input}
                placeholder="you@yourbusiness.com"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
              <View style={{ height: space.md }} />
              <Button label="Email me a link" onPress={sendLink} loading={busy} />
            </View>
          ) : (
            <View style={{ marginTop: space.xl }}>
              <Body>Check your email</Body>
              <Caption style={{ marginTop: space.xs }}>
                If an account exists for {email.trim()}, a sign-in link is on its way.
                Open it on this device to continue.
              </Caption>
              <Pressable onPress={() => setSent(false)} style={{ marginTop: space.lg }}>
                <Caption style={{ color: colors.clay }}>Use a different email</Caption>
              </Pressable>
            </View>
          )}

          {error ? <Caption style={styles.error}>{error}</Caption> : null}

          <Pressable
            onPress={() => setShowTokenEntry((v) => !v)}
            style={{ marginTop: space.xxl }}
          >
            <Caption style={{ color: colors.inkFaint }}>
              {showTokenEntry ? "Hide token entry" : "Have a sign-in token? Paste it"}
            </Caption>
          </Pressable>
          {showTokenEntry ? (
            <View style={{ marginTop: space.md }}>
              <TextInput
                style={styles.input}
                placeholder="Paste sign-in token"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                value={rawToken}
                onChangeText={setRawToken}
                editable={!busy}
              />
              <View style={{ height: space.md }} />
              <Button label="Sign in with token" variant="ghost" onPress={exchange} loading={busy} />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.xxl },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
    backgroundColor: colors.paperRaised,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: space.lg },
});
