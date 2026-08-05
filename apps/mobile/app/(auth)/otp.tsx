import { useState } from "react";
import { Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { authStyles } from "../../lib/auth-styles";

/**
 * OTP confirmation. Supabase phone-OTP codes are 6 digits (no per-SMS
 * otp_length override exists in config.toml — only [auth.email].otp_length /
 * [auth.mfa.phone].otp_length). packages/config strings corrected to say
 * 6 digits (2026-07-31); design/strings.ro.json + design/HANDOFF.md still
 * say 4 — design-source mismatch, not fixed here (not this project's file
 * to rewrite unilaterally).
 */
export default function OtpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace("/");
  }

  async function handleResend() {
    setError(null);
    await supabase.auth.signInWithOtp({ phone });
  }

  const canSubmit = code.trim().length > 0 && !loading;

  return (
    <View style={authStyles.container}>
      <Text style={authStyles.title}>{t("auth.otpTitle")}</Text>
      <Text style={authStyles.intro}>{t("auth.otpSentTo", { phone })}</Text>

      <TextInput
        style={authStyles.input}
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        placeholderTextColor="#6B7178"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
      />

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <Pressable
        style={[authStyles.button, !canSubmit && authStyles.buttonDisabled]}
        onPress={handleVerify}
        disabled={!canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#161307" />
        ) : (
          <Text style={authStyles.buttonText}>{t("common.confirm")}</Text>
        )}
      </Pressable>

      <Pressable style={authStyles.linkRow} onPress={handleResend}>
        <Text style={authStyles.linkText}>{t("auth.otpResend", { time: "60s" })}</Text>
      </Pressable>

      {/* 2026-08-06 fix — this screen was a dead end if the SMS never
          arrives (e.g. no SMS provider configured on a given project):
          no way back to login/register, no way out at all. router.back()
          returns to whichever screen pushed this one (login or register
          both do). */}
      <Pressable style={authStyles.linkRow} onPress={() => router.back()}>
        <Text style={[authStyles.linkText, { opacity: 0.7 }]}>{t("common.back")}</Text>
      </Pressable>
    </View>
  );
}
