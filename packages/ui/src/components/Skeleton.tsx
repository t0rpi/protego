import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../tokens";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/HANDOFF.md §3 Skeleton (listed, never built until this pass).
 * P2i QA fix: every tab screen's loading state was a bare
 * ActivityIndicator on an otherwise blank screen for up to ~6s on a
 * cold tab switch — this gives loading states a shape instead of
 * nothing, so the screen doesn't read as broken while data is still
 * in flight.
 */
export function Skeleton({ width = "100%", height = 16, borderRadius = tokens.radius.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: tokens.color.semantic.border },
        { opacity },
        style,
      ]}
    />
  );
}

/** A generic Card-shaped placeholder — title bar + two lines — reused
 * across screens instead of each hand-rolling its own skeleton shape. */
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={12} />
      <Skeleton width="85%" height={18} style={styles.gapTop} />
      <Skeleton width="35%" height={12} style={styles.gapTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.color.semantic.surfaceCard,
    borderRadius: tokens.radius.lg,
    borderWidth: tokens.border.width,
    borderColor: tokens.color.semantic.border,
    padding: tokens.spacing[4],
    gap: tokens.spacing[2],
  },
  gapTop: {
    marginTop: tokens.spacing[1],
  },
});
