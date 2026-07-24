import { Stack } from "expo-router";

/**
 * Root layout. M0 scope: minimal Stack shell only — dark theming via
 * @protego/ui tokens, font loading (Cinzel/Manrope) and real navigation
 * structure land with the first real screens (M1+), alongside packages/ui's
 * component library (see design/HANDOFF.md §3).
 */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
