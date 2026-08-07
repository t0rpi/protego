import { Linking, Platform } from "react-native";
import { reverseGeocode } from "./places";

export type PickupLocationResult =
  | { status: "ok"; formattedAddress: string; placeId: string }
  | { status: "services_disabled" }
  | { status: "permission_denied" }
  | { status: "unavailable" };

/**
 * GPS auto-location for the booking wizard's pickup field (2026-08-04
 * founder decision). Same "a new native module must never crash a build
 * that doesn't have it registered yet" guard as lib/push.ts — with one
 * extra wrinkle confirmed on-device (2026-08-04): a plain top-level
 * `import * as Location from "expo-location"` is NOT enough. Expo
 * Router eagerly requires every file under app/ at boot to build its
 * route table (unlike React Navigation's manual lazy imports), so
 * [service].tsx importing this module — even though the GPS function
 * itself only runs once the client reaches the "where" step — was
 * enough to touch expo-location's native binding at app launch, before
 * the dev-client APK that registers it had even been installed. A
 * try/catch around the async calls below doesn't help a crash that
 * happens at import time, before any of this code runs.
 *
 * Fix: require() the module lazily, inside the function, wrapped in its
 * own try/catch — the native binding is only ever touched when a caller
 * actually invokes getCurrentPickupLocation(), never at bundle load.
 */
type LocationModule = typeof import("expo-location");

function loadLocationModule(): LocationModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy, see comment above
    return require("expo-location") as LocationModule;
  } catch {
    return null;
  }
}

/**
 * The device coordinate itself is never dispatched on — it's reverse-
 * geocoded to Google's own formatted_address/place_id (via the
 * geocode-address Edge Function), which the caller then feeds through
 * the exact same PlaceAutocompleteInput confirmation path a typed
 * address goes through (never auto-confirmed here).
 */
export async function getCurrentPickupLocation(): Promise<PickupLocationResult> {
  const Location = loadLocationModule();
  if (!Location) {
    return { status: "unavailable" };
  }

  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return { status: "services_disabled" };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return { status: "permission_denied" };
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const geocoded = await reverseGeocode(position.coords.latitude, position.coords.longitude);
    if (!geocoded) {
      return { status: "unavailable" };
    }

    return { status: "ok", formattedAddress: geocoded.formatted_address, placeId: geocoded.place_id };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Client-6 fix (2026-08-05): "when location is OFF, the address field
 * just says location is disabled — instead, tapping the field should
 * PROMPT to enable GPS (system dialog / settings link)." Android has a
 * real native "turn on location?" dialog (enableNetworkProviderAsync) —
 * iOS has no equivalent (Apple doesn't let apps toggle system location),
 * so the only option there is deep-linking to the app's own Settings
 * page.
 *
 * F7 fix (2026-08-07, audit-findings.md): declining that Android dialog
 * used to fall through to Linking.openSettings() anyway, forcing a
 * Settings-app redirect right after the client had just said no.
 * Checked expo-location's native Android source
 * (LocationModule.kt:288-303) to see whether "declined" could be told
 * apart from "device can't resolve this at all" — it can't: BOTH cases
 * throw the exact same LocationSettingsUnsatisfiedException, so there is
 * no reliable signal here to distinguish them. Given that, the only
 * choice that respects an explicit "no" is to never auto-redirect after
 * an Android rejection — Settings is reserved for the platforms/cases
 * where the native prompt was never shown at all (iOS has no such
 * dialog; here, the module failing to load at all).
 *
 * P1a fix (2026-08-07, founder QA): the above only ever handled the
 * *services* toggle (GPS on/off) — it never actually did anything for a
 * *permission* denial (a completely different Android subsystem), so
 * tapping the hint after denying the permission prompt called
 * enableNetworkProviderAsync() (irrelevant to permissions) and, on
 * Android, never fell through to Settings either — a real dead end,
 * matching the founder's report exactly. Permission requests, unlike
 * the services dialog, DO expose a reliable signal for this
 * (`canAskAgain`): Android lets you re-show the system prompt once
 * after a first decline, and only forces you to Settings once the user
 * has denied it enough times that the OS stops offering it — no
 * ambiguity here, unlike the services-toggle case above.
 */
export async function promptEnableLocation(kind: "services_disabled" | "permission_denied"): Promise<void> {
  const Location = loadLocationModule();
  if (!Location) {
    await openSettingsSafely();
    return;
  }

  if (kind === "permission_denied") {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.canAskAgain) {
      await Location.requestForegroundPermissionsAsync();
      return;
    }
    await openSettingsSafely();
    return;
  }

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // Declined, or unresolvable — indistinguishable from this API, so
      // stay on manual entry rather than second-guess the client's "no".
    }
    return;
  }
  await openSettingsSafely();
}

async function openSettingsSafely(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Nothing more we can do — the client can still type the address.
  }
}
