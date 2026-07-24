import { useState } from "react";
import { Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { authStyles } from "../../lib/auth-styles";

/**
 * Registration — phone OTP + email (MASTERPROMPT §5A: "Cont: telefon OTP +
 * email"). Level 1 verification is granted server-side (handle_new_user
 * trigger) the moment the OTP is verified — see supabase/migrations/
 * 20260724140002_audit_log.sql.
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    setError(null);
    setLoading(true);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
      options: { data: { email } },
    });

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
      <Text style={authStyles.title}>{t("auth.title")}</Text>
      <Text style={authStyles.intro}>{t("auth.intro")}</Text>

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

      <View>
        <Text style={authStyles.label}>{t("auth.email")}</Text>
        <TextInput
          style={authStyles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#6B7178"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
      </View>

      <Text style={authStyles.note}>{t("auth.terms")}</Text>

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

      <Link href="/login" style={authStyles.linkRow}>
        <Text style={authStyles.linkText}>{t("common.back")}</Text>
      </Link>
    </View>
  );
}
