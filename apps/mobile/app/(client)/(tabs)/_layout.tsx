import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { tokens } from "@protego/ui";

type IoniconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IoniconName, inactive: IoniconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={22} color={color as string} />;
  }
  return TabIcon;
}

/**
 * Client tab bar (design/HANDOFF.md §3 TabBar, §8.2: 4 tabs incl. Shield
 * as a permanent tab — a PRD §3 requirement missing from the original
 * prototype). P2a QA fix (2026-08-07): no tabBarIcon meant the vendored
 * bottom-tabs renderIcon() returned null and reserved zero space for an
 * icon — founder/coordinator described the resulting gap as an "empty
 * box" on every tab. Wired real Ionicons (already bundled with Expo,
 * no native rebuild) instead of waiting for the planned Lucide pass.
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
      <Tabs.Screen
        name="index"
        options={{ title: t("tabs.home"), tabBarIcon: tabIcon("home", "home-outline") }}
      />
      <Tabs.Screen
        name="shield"
        options={{ title: t("tabs.shield"), tabBarIcon: tabIcon("shield", "shield-outline") }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t("tabs.history"), tabBarIcon: tabIcon("time", "time-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person", "person-outline") }}
      />
    </Tabs>
  );
}
