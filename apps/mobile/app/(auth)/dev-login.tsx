import { useState } from "react";
import { Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { authStyles } from "../../lib/auth-styles";

/**
 * Dev/QA-only entry point: email+password sign-in for seeded test accounts
 * (docs/testing/demo-accounts.md), bypassing phone OTP. Needed because the
 * remote project has no SMS provider configured yet, so the real
 * register/login screens (phone OTP, per MASTERPROMPT §5A) can't be used
 * for hands-on device testing today. Not part of the product's real auth
 * flow — do not localize, do not link from onboarding, remove or gate
 * behind a build flag before any real App Store submission.
 */
export default function DevLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/");
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <View style={authStyles.container}>
      <Text style={authStyles.title}>Dev login (test only)</Text>
      <Text style={authStyles.intro}>
        Email/password sign-in for seeded test accounts — see docs/testing/demo-accounts.md. Not
        part of the real app flow.
      </Text>

      <View>
        <Text style={authStyles.label}>Email</Text>
        <TextInput
          style={authStyles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="agent.demo@protego-test.ro"
          placeholderTextColor="#6B7178"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
      </View>

      <View>
        <Text style={authStyles.label}>Password</Text>
        <TextInput
          style={authStyles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#6B7178"
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
        />
      </View>

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <Pressable
        style={[authStyles.button, !canSubmit && authStyles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={!canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#161307" />
        ) : (
          <Text style={authStyles.buttonText}>Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}
