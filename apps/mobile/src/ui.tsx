// Minimal shared UI primitives for the agentplain mobile app.
//
// Deliberately tiny and hand-kept — V1 ships a handful of screens and does not
// warrant a full component library. These wrap React Native primitives with
// the brand tokens (theme.ts) so screens read consistently. If this grows past
// a screenful, promote it to a real design-system package.

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, space, type } from "./theme";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={type.eyebrow}>{children}</Text>;
}

export function H1({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.h1, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.h2, style]}>{children}</Text>;
}

export function Body({
  children,
  soft,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  soft?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  return (
    <Text style={[soft ? type.bodySoft : type.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Caption({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[type.caption, style]}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.paperRaised : colors.ink} />
      ) : (
        <Text style={[styles.buttonLabel, isPrimary ? styles.buttonLabelPrimary : styles.buttonLabelGhost]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Pill({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "positive" | "pending" }) {
  const toneStyle =
    tone === "positive"
      ? { bg: colors.sageWash, fg: colors.sage }
      : tone === "pending"
        ? { bg: colors.clayWash, fg: colors.amber }
        : { bg: colors.line, fg: colors.inkSoft };
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.pillText, { color: toneStyle.fg }]}>{text}</Text>
    </View>
  );
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <Centered>
      <ActivityIndicator color={colors.clay} />
      {label ? <Caption style={{ marginTop: space.md }}>{label}</Caption> : null}
    </Centered>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paperRaised,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.lg,
  },
  button: {
    height: 50,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  buttonPrimary: { backgroundColor: colors.clay },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.lineStrong,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
  buttonLabelPrimary: { color: colors.paperRaised },
  buttonLabelGhost: { color: colors.ink },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  pillText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl },
});
