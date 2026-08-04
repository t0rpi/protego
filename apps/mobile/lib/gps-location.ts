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
