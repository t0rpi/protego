import { useState } from "react";
import { Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { authStyles } from "../../lib/auth-styles";

/**
 * OTP confirmation. Note: design/strings.ro.json's auth.terms promises a
 * "cod SMS de 4 cifre", but Supabase phone-OTP codes are 6 digits and the
 * CLI's config.toml has no per-SMS otp_length override (only
 * [auth.email].otp_length / [auth.mfa.phone].otp_length exist) — this
 * screen accepts what Supabase actually sends (6 digits), not the design
 * copy's stated 4. Flagged for design/copy follow-up, not silently changed.
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
    </View>
  );
}
