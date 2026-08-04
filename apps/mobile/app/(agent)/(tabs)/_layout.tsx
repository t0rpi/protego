import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";

/**
 * Agent tab bar (2026-08-04 tab bar nav pass) — Home (availability/offer/
 * mission entry points, unchanged content, just relocated), Earnings
 * (unchanged content, relocated), Profile (new, minimal). Screen-content
 * restyle onto the packages/ui component library is Pass D, not this
 * pass — see that work's own commit notes.
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
      <Tabs.Screen name="agent" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="earnings" options={{ title: t("agentApp.earningsTitle") }} />
      <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
    </Tabs>
  );
}
