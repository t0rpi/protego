import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  computeMapBounds,
  decodePolyline,
  projectToUnit,
  type LatLng,
  type MapMarker,
  type MapMarkerKind,
} from "@protego/domain";
import { tokens } from "../tokens";

export type { MapMarker, MapMarkerKind } from "@protego/domain";

interface MapProps {
  center?: LatLng;
  markers: MapMarker[];
  /** Google encoded polyline (pass the raw string from route-distance — decoded here). */
  encodedPolyline?: string | null;
  onMarkerPress?: (marker: MapMarker) => void;
  height?: number;
}

const MARKER_COLOR: Record<MapMarkerKind, string> = {
  origin: tokens.color.base.gold,
  destination: tokens.color.base.gold,
  agent: tokens.color.base.gold,
  mission: tokens.color.base.gold,
  sos: tokens.color.base.danger,
};

/**
 * design/HANDOFF.md §6 — the Map component is a SLOT, not an
 * implementation: `{ center, markers[] (agent|mission|sos|origin|
 * destination), route?, onMarkerPress }`. Prototypes use "static SVG"
 * per that spec, but this app has no react-native-svg dependency yet
 * (deliberately avoided — every native module added this session has
 * needed a fresh EAS dev-client build before it's usable, and this slot
 * is designed so swapping the rendering technique later, per Google
 * Maps or Mapbox, never touches the screens that use it). Plain
 * absolutely-positioned Views approximate the same visual spec instead:
 * dark background, a "dashed" gold route built from short rotated
 * segments, and pins with a halo on live points.
 */
export function Map({ center, markers, encodedPolyline, onMarkerPress, height = 200 }: MapProps) {
  const [size, setSize] = useState({ width: 0, height });
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => undefined);
  }, []);

  function onLayout(e: LayoutChangeEvent) {
    setSize({ width: e.nativeEvent.layout.width, height });
  }

  const route = encodedPolyline ? decodePolyline(encodedPolyline) : [];
  const boundsPoints: LatLng[] = [
    ...(center ? [center] : []),
    ...markers.map((m) => ({ lat: m.lat, lng: m.lng })),
    ...route,
  ];
  const bounds = computeMapBounds(boundsPoints);

  function toPixel(point: LatLng) {
    const unit = projectToUnit(point, bounds);
    return { x: unit.x * size.width, y: unit.y * size.height };
  }

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout}>
      {/* decorative "streets" texture per §6 — not real street data,
          just visual texture so the canvas doesn't read as empty */}
      <View style={styles.streetH} />
      <View style={[styles.streetH, { top: "62%" }]} />
      <View style={styles.streetV} />
      <View style={[styles.streetV, { left: "70%" }]} />

      {size.width > 0
        ? route.slice(0, -1).map((p, i) => {
            const next = route[i + 1];
            if (!next) return null;
            return <RouteSegment key={i} from={toPixel(p)} to={toPixel(next)} />;
          })
        : null}

      {size.width > 0
        ? markers.map((marker) => {
            const { x, y } = toPixel(marker);
            const isLive = marker.kind === "agent" || marker.kind === "sos";
            return (
              <Pressable
                key={marker.id}
                onPress={() => onMarkerPress?.(marker)}
                style={[styles.markerWrap, { left: x - 14, top: y - 14 }]}
                accessibilityRole={onMarkerPress ? "button" : undefined}
                accessibilityLabel={marker.label ?? marker.kind}
              >
                {isLive ? (
                  <Halo color={MARKER_COLOR[marker.kind]} pulse={marker.kind === "sos"} reduceMotion={reduceMotion} />
                ) : null}
                <View
                  style={[
                    marker.kind === "destination" ? styles.pinSquare : styles.pinDot,
                    { backgroundColor: MARKER_COLOR[marker.kind] },
                  ]}
                />
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

function RouteSegment({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const dashLength = 6;
  const gapLength = 5;
  const step = dashLength + gapLength;
  const dashCount = Math.max(1, Math.floor(length / step));

  const dashes = [];
  for (let i = 0; i < dashCount; i++) {
    const distAlong = i * step + dashLength / 2;
    const cx = from.x + Math.cos(angle) * distAlong;
    const cy = from.y + Math.sin(angle) * distAlong;
    dashes.push(
      <View
        key={i}
        style={[
          styles.dash,
          {
            left: cx - dashLength / 2,
            top: cy - 1,
            width: dashLength,
            transform: [{ rotate: `${angle}rad` }],
          },
        ]}
      />
    );
  }
  return <>{dashes}</>;
}

function Halo({ color, pulse, reduceMotion }: { color: string; pulse: boolean; reduceMotion: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion, scale]);

  return (
    <Animated.View
      style={[
        styles.halo,
        { backgroundColor: color === tokens.color.base.danger ? tokens.color.base.dangerDim : tokens.color.base.goldDim2 },
        pulse ? { transform: [{ scale }] } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#101216",
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  streetH: {
    position: "absolute",
    top: "38%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#1B1E24",
  },
  streetV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "30%",
    width: 1,
    backgroundColor: "#22252C",
  },
  dash: {
    position: "absolute",
    height: 2,
    borderRadius: 1,
    backgroundColor: tokens.color.base.gold,
  },
  markerWrap: {
    position: "absolute",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.color.base.ink,
  },
  pinSquare: {
    width: 11,
    height: 11,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: tokens.color.base.ink,
    transform: [{ rotate: "45deg" }],
  },
  halo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
