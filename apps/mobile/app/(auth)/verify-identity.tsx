import { useState } from "react";
import { Text, Pressable, View, ActivityIndicator, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { authStyles } from "../../lib/auth-styles";

type UploadSlot = "idCard" | "selfie";

/**
 * Level-2 verification (CI + selfie) — PRD §7, acceptance-tests.md M1.
 * Review is manual (a dispatcher calls review_identity_verification();
 * see supabase/migrations/20260724140005_identity_verification.sql) — no
 * automated ID/face checks. Deliberately does NOT show design/
 * strings.ro.json's idv.done ("Identitate verificată. Bine ai venit!")
 * on submit, since that copy assumes instant automated verification;
 * this screen shows idv.pending instead, so the client isn't told
 * they're verified before a dispatcher has actually reviewed anything.
 */
export default function VerifyIdentityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();

  const [idCardUri, setIdCardUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [idCardPath, setIdCardPath] = useState<string | null>(null);
  const [selfiePath, setSelfiePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState<UploadSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUpload(slot: UploadSlot) {
    setError(null);

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !session) return;

    const asset = result.assets[0];
    const extension = asset.uri.split(".").pop() ?? "jpg";
    const path = `${session.user.id}/${slot === "idCard" ? "id-card" : "selfie"}-${Date.now()}.${extension}`;

    setUploading(slot);

    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("identity-documents")
      .upload(path, blob, { contentType: asset.mimeType ?? "image/jpeg" });

    setUploading(null);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    if (slot === "idCard") {
      setIdCardUri(asset.uri);
      setIdCardPath(path);
    } else {
      setSelfieUri(asset.uri);
      setSelfiePath(path);
    }
  }

  async function handleSubmit() {
    if (!session || !idCardPath || !selfiePath) return;

    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from("identity_verifications").insert({
      user_id: session.user.id,
      id_card_path: idCardPath,
      selfie_path: selfiePath,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={authStyles.container}>
        <Text style={authStyles.title}>{t("idv.pending")}</Text>
        <Text style={authStyles.intro}>{t("idv.intro")}</Text>
        <Pressable style={authStyles.button} onPress={() => router.replace("/")}>
          <Text style={authStyles.buttonText}>{t("common.continue")}</Text>
        </Pressable>
      </View>
    );
  }

  const canFinish = Boolean(idCardPath && selfiePath) && !submitting;

  return (
    <View style={authStyles.container}>
      <Text style={authStyles.title}>{t("idv.title")}</Text>
      <Text style={authStyles.intro}>{t("idv.intro")}</Text>

      <View>
        <Text style={authStyles.label}>{t("idv.idCard")}</Text>
        <Text style={authStyles.note}>{t("idv.idCardDesc")}</Text>
        {idCardUri ? (
          <Image
            source={{ uri: idCardUri }}
            style={{ height: 120, borderRadius: 8, marginTop: 8 }}
          />
        ) : null}
        <Pressable style={authStyles.button} onPress={() => pickAndUpload("idCard")}>
          {uploading === "idCard" ? (
            <ActivityIndicator color="#161307" />
          ) : (
            <Text style={authStyles.buttonText}>
              {idCardPath ? t("idv.uploaded") : t("idv.idCard")}
            </Text>
          )}
        </Pressable>
      </View>

      <View>
        <Text style={authStyles.label}>{t("idv.selfie")}</Text>
        <Text style={authStyles.note}>{t("idv.selfieDesc")}</Text>
        {selfieUri ? (
          <Image
            source={{ uri: selfieUri }}
            style={{ height: 120, borderRadius: 8, marginTop: 8 }}
          />
        ) : null}
        <Pressable style={authStyles.button} onPress={() => pickAndUpload("selfie")}>
          {uploading === "selfie" ? (
            <ActivityIndicator color="#161307" />
          ) : (
            <Text style={authStyles.buttonText}>
              {selfiePath ? t("idv.uploaded") : t("idv.selfie")}
            </Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={authStyles.error}>{error}</Text> : null}

      <Pressable
        style={[authStyles.button, !canFinish && authStyles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canFinish}
      >
        {submitting ? (
          <ActivityIndicator color="#161307" />
        ) : (
          <Text style={authStyles.buttonText}>{t("idv.finish")}</Text>
        )}
      </Pressable>
    </View>
  );
}
