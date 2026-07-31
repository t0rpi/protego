import { useState } from "react";
import { Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { authStyles } from "../../lib/auth-styles";

/**
 * Returning-user entry point. Phone OTP is inherently passwordless and
 * provider-agnostic between "new" and "existing" accounts (Supabase's
 * signInWithOtp signs in an existing user or creates one transparently) —
 * the design strings (design/strings.ro.json "auth") don't define distinct
 * copy for a separate login screen, so this reuses auth.phone/sendCode
 * without the email field or terms recap already shown at registration.
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });

    setLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    router.push({ pathname: "/otp", params: { phone } });
  }

  const canSubmit = phone.trim().length > 0 && !loading;

  return (
    <View style={authStyles.container}>
      <Text style={authStyles.title}>{t("common.appName")}</Text>
      <Text style={authStyles.intro}>{t("common.tagline")}</Text>

      <View>
        <Text style={authStyles.label}>{t("auth.phone")}</Text>
        <TextInput
          style={authStyles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+40 7xx xxx xxx"
          placeholderTextColor="#6B7178"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
      </View>

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <Pressable
        style={[authStyles.button, !canSubmit && authStyles.buttonDisabled]}
        onPress={handleSendCode}
        disabled={!canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#161307" />
        ) : (
          <Text style={authStyles.buttonText}>{t("auth.sendCode")}</Text>
        )}
      </Pressable>

      <Link href="/register" style={authStyles.linkRow}>
        <Text style={authStyles.linkText}>{t("onboarding.ctaLast")}</Text>
      </Link>

      {__DEV__ ? (
        <Link href="/dev-login" style={authStyles.linkRow}>
          <Text style={[authStyles.linkText, { opacity: 0.5 }]}>Dev login (test only)</Text>
        </Link>
      ) : null}
    </View>
  );
}
