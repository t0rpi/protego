import * as Location from "expo-location";
import { reverseGeocode } from "./places";

export type PickupLocationResult =
  | { status: "ok"; formattedAddress: string; placeId: string }
  | { status: "services_disabled" }
  | { status: "permission_denied" }
  | { status: "unavailable" };

/**
 * GPS auto-location for the booking wizard's pickup field (2026-08-04
 * founder decision). Same "a new native module must never crash a build
 * that doesn't have it registered yet" guard as lib/push.ts — this is a
 * brand-new module (expo-location) not present in any build until the
 * next EAS dev-client build ships, so every call here is wrapped and
 * degrades to `unavailable` (manual entry) rather than throwing.
 *
 * The device coordinate itself is never dispatched on — it's reverse-
 * geocoded to Google's own formatted_address/place_id (via the
 * geocode-address Edge Function), which the caller then feeds through
 * the exact same PlaceAutocompleteInput confirmation path a typed
 * address goes through (never auto-confirmed here).
 */
export async function getCurrentPickupLocation(): Promise<PickupLocationResult> {
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
