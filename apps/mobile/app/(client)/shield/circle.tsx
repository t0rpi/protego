import { useCallback, useState } from "react";
import { StyleSheet, Text, View, Pressable, TextInput, FlatList, Alert, Share } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { tokens } from "@protego/ui";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../lib/auth-context";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

/** Trusted circle (design `circle.*`) — CRUD is thin by design (no
 * dedicated remove/list-empty copy exists yet in the i18n scaffold from
 * the design handoff), so this screen adds its own minimal, obviously
 * secondary "Elimină" affordance rather than blocking on new copy. */
export default function TrustedCircleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("shield_contacts")
      .select("id, name, phone")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: true });
    setContacts(data ?? []);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function addContact() {
    if (!session || !name.trim() || !phone.trim()) return;
    const { error } = await supabase
      .from("shield_contacts")
      .insert({ owner_id: session.user.id, name: name.trim(), phone: phone.trim() });
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    setName("");
    setPhone("");
    load();
  }

  async function removeContact(id: string) {
    await supabase.from("shield_contacts").delete().eq("id", id);
    load();
  }

  async function sendLink() {
    setSending(true);
    const { data, error } = await supabase.rpc("create_shield_share_link");
    setSending(false);
    if (error) {
      Alert.alert(t("common.close"), error.message);
      return;
    }
    const url = `https://protego.app/s/${data}`;
    await Share.share({ message: url });
    Alert.alert(t("circle.sent", { name: contacts[0]?.name ?? "" }));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>{t("circle.intro")}</Text>

      <FlatList
        style={styles.list}
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.contactRow}>
            <View>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactPhone}>{item.phone}</Text>
            </View>
            <Pressable onPress={() => removeContact(item.id)}>
              <Text style={styles.removeLink}>{t("circle.remove")}</Text>
            </Pressable>
          </View>
        )}
      />

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t("circle.namePlaceholder")}
        placeholderTextColor={tokens.color.base.steelDim}
      />
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder={t("circle.phonePlaceholder")}
        placeholderTextColor={tokens.color.base.steelDim}
        keyboardType="phone-pad"
      />
      <Pressable style={styles.addButton} onPress={addContact}>
        <Text style={styles.addButtonText}>{t("circle.add")}</Text>
      </Pressable>

      <Pressable style={styles.sendButton} onPress={sendLink} disabled={sending}>
        <Text style={styles.sendButtonText}>{t("circle.sendLink")}</Text>
      </Pressable>

      <Pressable onPress={() => router.back()}>
        <Text style={styles.backLink}>{t("common.back")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.color.base.ink,
    gap: tokens.spacing[3],
    padding: tokens.spacing[6],
  },
  intro: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.small,
  },
  list: {
    maxHeight: 220,
  },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: tokens.color.base.graphite,
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing[3],
    marginBottom: tokens.spacing[2],
  },
  contactName: {
    color: tokens.color.semantic.textPrimary,
    fontSize: tokens.typography.size.body,
    fontWeight: "600",
  },
  contactPhone: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.caption,
  },
  removeLink: {
    color: tokens.color.base.danger,
    fontSize: tokens.typography.size.caption,
  },
  input: {
    backgroundColor: tokens.color.base.graphite,
    borderRadius: tokens.radius.sm,
    borderColor: tokens.color.base.line,
    borderWidth: tokens.border.width,
    color: tokens.color.semantic.textPrimary,
    padding: tokens.spacing[3],
  },
  addButton: {
    borderColor: tokens.color.base.line,
    borderWidth: tokens.border.width,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.spacing.tapMin,
  },
  addButtonText: {
    color: tokens.color.base.steel,
    fontSize: tokens.typography.size.title,
  },
  sendButton: {
    backgroundColor: tokens.color.base.gold,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing[3],
    alignItems: "center",
    justifyContent: "center",
    minHeight: tokens.spacing.tapMin,
    marginTop: tokens.spacing[4],
  },
  sendButtonText: {
    color: tokens.color.semantic.textOnGold,
    fontSize: tokens.typography.size.title,
    fontWeight: "600",
  },
  backLink: {
    color: tokens.color.base.steelDim,
    fontSize: tokens.typography.size.small,
    alignSelf: "center",
    marginTop: tokens.spacing[3],
  },
});
