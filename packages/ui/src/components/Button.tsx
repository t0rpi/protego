import { ActivityIndicator, Pressable, Text, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { tokens } from "../tokens";

export type ButtonVariant = "primary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * design/HANDOFF.md §3 Button: variant primary/ghost/danger, size sm,
 * loading, disabled. States: default/active(scale .985)/focus/disabled/
 * loading. "Max UN buton gold per ecran" is a per-screen composition
 * rule, not enforceable by this component itself.
 */
export function Button({ label, variant = "primary", size = "md", loading, disabled, style, ...pressableProps }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }: { pressed: boolean }) => [
        buttonBaseStyle(variant, size),
        pressed && !isDisabled ? { transform: [{ scale: tokens.motion.pressScale }] } : null,
        isDisabled ? { opacity: 0.5 } : null,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? tokens.color.base.gold : tokens.color.semantic.textOnGold} />
      ) : (
        <Text style={textStyle(variant, size)}>{label}</Text>
      )}
    </Pressable>
  );
}

function buttonBaseStyle(variant: ButtonVariant, size: ButtonSize): ViewStyle {
  const base: ViewStyle = {
    minHeight: size === "sm" ? 38 : tokens.spacing.tapMin,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: tokens.spacing[6],
    flexDirection: "row",
  };
  if (variant === "primary") {
    return { ...base, backgroundColor: tokens.color.base.gold };
  }
  if (variant === "danger") {
    return { ...base, backgroundColor: tokens.color.base.danger };
  }
  return {
    ...base,
    backgroundColor: "transparent",
    borderWidth: tokens.border.width,
    borderColor: tokens.color.semantic.border,
  };
}

function textStyle(variant: ButtonVariant, size: ButtonSize) {
  return {
    fontSize: size === "sm" ? tokens.typography.size.small : tokens.typography.size.title,
    fontWeight: "700" as const,
    color: variant === "ghost" ? tokens.color.base.gold : tokens.color.semantic.textOnGold,
  };
}
