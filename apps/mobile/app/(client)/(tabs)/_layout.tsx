import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";

/**
 * Client tab bar (design/HANDOFF.md §3 TabBar, §8.2: 4 tabs incl. Shield
 * as a permanent tab — a PRD §3 requirement missing from the original
 * prototype). Real iconography (Lucide, per §8.2 point 1) lands in a
 * later pass alongside the fonts/svg native-module build — text-only
 * labels for now is a disclosed interim state, not a silent shortcut.
 * Booking/mission/verify-identity stay outside this group as Stack-
 * pushed screens (unchanged), reachable from the Home tab.
 */
export default function ClientTabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.color.base.gold,
        tabBarInactiveTintColor: tokens.color.semantic.textTertiary,
        tabBarStyle: {
          backgroundColor: tokens.color.semantic.surfaceCard,
          borderTopColor: tokens.color.semantic.border,
        },
        tabBarLabelStyle: {
          fontSize: tokens.typography.size.micro,
          fontWeight: "700",
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="shield" options={{ title: t("tabs.shield") }} />
      <Tabs.Screen name="history" options={{ title: t("tabs.history") }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
    </Tabs>
  );
}
