import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR, INCORRECT_PASSWORD } from '@/data/errors';
import { useOutboxContext } from '@/features/outbox/useOutbox';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

export function DeleteAccountScreen() {
  const router = useRouter();
  const { repos } = useServices();
  // Captured now: signing out unmounts the provider, so it can't be read afterwards.
  const { outbox } = useOutboxContext();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = async () => {
    if (busyRef.current || password.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await repos.auth.deleteAccount(password);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error && e.message === INCORRECT_PASSWORD ? INCORRECT_PASSWORD : GENERIC_ERROR);
      busyRef.current = false;
      if (mounted.current) setBusy(false);
      return;
    }
    try {
      await outbox.clear();
    } catch {
      // The account is already gone; leftover local drafts are unreachable and harmless.
    }
    busyRef.current = false;
    if (mounted.current) setBusy(false);
  };

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Delete account
      </Text>
      <Text style={styles.body}>
        This permanently deletes your account, your profile, and every memory, photo and voice note you created. This
        cannot be undone.
      </Text>
      <TextInput
        accessibilityLabel="Confirm your password"
        placeholder="Confirm your password"
        placeholderTextColor={colors.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        value={password}
        onChangeText={setPassword}
        editable={!busy}
        style={styles.input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete permanently"
        accessibilityState={{ disabled: busy || password.length === 0 }}
        disabled={busy || password.length === 0}
        onPress={submit}
        style={[styles.danger, (busy || password.length === 0) && styles.disabled]}
      >
        <Text style={styles.dangerText}>Delete permanently</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => router.back()} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, paddingTop: 64 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 22, marginBottom: 20 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: colors.danger, marginBottom: 12 },
  danger: { backgroundColor: colors.danger, borderRadius: 10, padding: 14, alignItems: 'center' },
  dangerText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  cancel: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelText: { color: colors.accent, fontSize: 16 },
});
