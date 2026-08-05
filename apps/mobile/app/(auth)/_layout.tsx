import { Stack } from "expo-router";

/**
 * Auth group layout. Explicit `initialRouteName` + declared screens
 * (2026-08-06 fix) — before the root layout's Stack.Protected refactor
 * (980e33b, logout crash fix), the whole app was one flat, unguarded
 * Stack, so whichever screen Expo Router happened to pick as "first"
 * inside this folder barely mattered in practice. Once `(auth)` became
 * its own Protected group with its own nested Stack, that ambiguity
 * became a real bug: without an explicit initial route, this group
 * could land on any auto-discovered screen — register.tsx or otp.tsx
 * instead of login.tsx — which also meant the dev-only login link
 * (login.tsx only) silently became unreachable. `login` must always be
 * the entry point; do not remove `initialRouteName` again.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="dev-login" />
      <Stack.Screen name="verify-identity" />
    </Stack>
  );
}
