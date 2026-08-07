/**
 * Pass B — the `Map` component is a SLOT, not an implementation
 * (design/HANDOFF.md §6): `{ center, markers[] (agent|mission|sos|
 * origin|destination), route?, onMarkerPress }`. This file holds the
 * platform-agnostic pieces of that contract — the prop shapes and the
 * Google polyline decoder — shared by the mobile (View-based) and web
 * (SVG-based) implementations so neither drifts from the spec or from
 * each other.
 */

export type MapMarkerKind = "agent" | "mission" | "sos" | "origin" | "destination";

export interface MapMarker {
  id: string;
  kind: MapMarkerKind;
  lat: number;
  lng: number;
  label?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapProps {
  center?: LatLng;
  markers: MapMarker[];
  /** Ordered route points (already-decoded polyline), gold dashed per spec. */
  route?: LatLng[];
}

/**
 * Standard Google encoded-polyline decoder (the same algorithm Google's
 * own Maps/Directions SDKs use) — no third-party dependency needed for
 * something this small and stable. Returns [] on malformed input rather
 * than throwing, since a route line is decoration, not something that
 * should ever break a screen.
 */
export function decodePolyline(encoded: string): LatLng[] {
  if (!encoded) return [];
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }
  } catch {
    return [];
  }

  return points;
}

/**
 * Normalizes a set of lat/lng points into a bounding box with padding,
 * for projecting onto a fixed-size canvas. Both the mobile (View-based)
 * and web (SVG) Map implementations use this so a single-point (or
 * degenerate, all-identical-points) input still produces a sane,
 * non-zero-size box instead of a division-by-zero canvas.
 */
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const MIN_SPAN_DEGREES = 0.004; // ~400m — keeps a single-point view from zooming to nothing

export function computeMapBounds(points: LatLng[]): MapBounds {
  if (points.length === 0) {
    return { minLat: -MIN_SPAN_DEGREES, maxLat: MIN_SPAN_DEGREES, minLng: -MIN_SPAN_DEGREES, maxLng: MIN_SPAN_DEGREES };
  }
  const first = points[0]!;
  let minLat = first.lat;
  let maxLat = first.lat;
  let minLng = first.lng;
  let maxLng = first.lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const latSpan = Math.max(maxLat - minLat, MIN_SPAN_DEGREES);
  const lngSpan = Math.max(maxLng - minLng, MIN_SPAN_DEGREES);
  const latPad = latSpan * 0.2;
  const lngPad = lngSpan * 0.2;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return {
    minLat: centerLat - latSpan / 2 - latPad,
    maxLat: centerLat + latSpan / 2 + latPad,
    minLng: centerLng - lngSpan / 2 - lngPad,
    maxLng: centerLng + lngSpan / 2 + lngPad,
  };
}

/** Projects a lat/lng into [0,1] x/y fractions within `bounds` (y=0 at the top, i.e. maxLat). */
export function projectToUnit(point: LatLng, bounds: MapBounds): { x: number; y: number } {
  const latSpan = bounds.maxLat - bounds.minLat || 1;
  const lngSpan = bounds.maxLng - bounds.minLng || 1;
  return {
    x: (point.lng - bounds.minLng) / lngSpan,
    y: 1 - (point.lat - bounds.minLat) / latSpan,
  };
}
