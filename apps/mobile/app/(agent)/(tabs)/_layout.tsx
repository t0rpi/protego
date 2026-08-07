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
 * Agent tab bar (2026-08-04 tab bar nav pass) — Home (availability/offer/
 * mission entry points, unchanged content, just relocated), Earnings
 * (unchanged content, relocated), Profile (new, minimal). Screen-content
 * restyle onto the packages/ui component library is Pass D, not this
 * pass — see that work's own commit notes.
 *
 * P2a QA fix (2026-08-07): no tabBarIcon meant the vendored bottom-tabs
 * renderIcon() returned null for every tab — founder/coordinator saw
 * this as an "empty box" on both apps. Wired real Ionicons here too.
 */
export default function AgentTabsLayout() {
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
        name="agent"
        options={{ title: t("tabs.home"), tabBarIcon: tabIcon("home", "home-outline") }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: t("agentApp.earningsTitle"),
          tabBarIcon: tabIcon("cash", "cash-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person", "person-outline") }}
      />
    </Tabs>
  );
}
