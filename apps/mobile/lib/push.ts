import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

// Founder QA (2026-08-04): this runs unconditionally at module scope
// (imported from auth-context.tsx, mounted at the root layout), so a
// broken/missing native notifications module on a given build must
// never crash the whole app before anything renders -- same defense
// pattern as lib/stripe-key-guard.tsx. Root cause of one real crash:
// expo-notifications was never registered in app.json's plugins array,
// so the installed dev-client build's native side wasn't configured
// for it (fixed there too, but this guard stays regardless).
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // No notification handler this session is not a reason to crash the app.
}

/**
 * Real Expo push registration (not a stub — the SMS fallback is the
 * stub, per this milestone's scope). Requests permission, gets an Expo
 * push token, and upserts it into push_tokens so notify_event()
 * (supabase/migrations/20260731120005_notifications.sql) has somewhere
 * to send to.
 *
 * A real Expo push token normally needs an EAS project ID
 * (app.json/eas.json), which this project hasn't configured yet — that
 * is a build/deployment concern, not something this milestone's app
 * code can fix. getExpoPushTokenAsync() is wrapped so a missing project
 * ID (or denied permission, or running in an environment without push
 * capability) fails quietly rather than crashing the screen that calls this.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    await supabase
      .from("push_tokens")
      .upsert({ user_id: userId, expo_push_token: token.data }, { onConflict: "user_id,expo_push_token" });
  } catch {
    // Best-effort — see the function comment. No push token this
    // session is not a reason to break the screen that requested one.
  }
}
