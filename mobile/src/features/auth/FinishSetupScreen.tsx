import { useRouter } from 'expo-router';
import { createContext, useContext, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GENERIC_ERROR, USER_EXISTS } from '@/data/errors';
import { DISPLAY_NAME_ERROR } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';
import { FINISH_SETUP_CONTINUE, FINISH_SETUP_TITLE, SIGN_OUT_LABEL } from '@/ui/copy';
import { Notice } from '@/ui/Notice';
import { colors } from '@/ui/theme';

import { completeRegistration } from './repairRegistration';
import { TERMS_LABEL, TERMS_REQUIRED } from './SignInScreen';
import { validateDisplayName } from './validators';

/** The signed-in layout provides this so it learns the repair is done before the redirect runs again. */
export const RepairDoneContext = createContext<() => void>(() => {});

/** Shown to a signed-in account that has no users doc (a registration that stopped part-way). */
export function FinishSetupScreen({ session, onDone }: { session: AuthSession; onDone?: () => void }) {
  const services = useServices();
  const router = useRouter();
  const contextDone = useContext(RepairDoneContext);
  const [name, setName] = useState(session.displayName ?? '');
  const [acceptedAt, setAcceptedAt] = useState<Date | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const nErr = validateDisplayName(name);
    setNameError(nErr);
    setTermsError(acceptedAt ? null : TERMS_REQUIRED);
    setFormError(null);
    if (nErr || !acceptedAt) return;
    setBusy(true);
    try {
      await completeRegistration(services, session, name, acceptedAt);
      (onDone ?? contextDone)();
      router.replace('/');
    } catch (e) {
      if (e instanceof Error && e.message === USER_EXISTS) {
        // Already set up (another device or a repeated tap): nothing to write, go on.
        (onDone ?? contextDone)();
        router.replace('/');
      } else if (e instanceof Error && e.message === DISPLAY_NAME_ERROR) setNameError(DISPLAY_NAME_ERROR);
      else {
        console.warn('Could not finish setting up', e);
        setFormError(GENERIC_ERROR);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          {FINISH_SETUP_TITLE}
        </Text>
        <View style={styles.gap}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            accessibilityLabel="Name"
            testID="name-input"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, nameError ? styles.inputError : null]}
          />
          {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
        </View>
        <View style={styles.gap}>
          <Pressable
            testID="terms-checkbox"
            accessibilityRole="checkbox"
            accessibilityLabel={TERMS_LABEL}
            accessibilityState={{ checked: acceptedAt !== null }}
            onPress={() => setAcceptedAt(acceptedAt ? null : services.now())}
            style={styles.checkRow}
          >
            <View style={[styles.box, acceptedAt && styles.boxChecked]}>
              {acceptedAt && <Text style={styles.tick}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>{TERMS_LABEL}</Text>
          </Pressable>
          {termsError ? <Text style={styles.error}>{termsError}</Text> : null}
        </View>
        <Notice tone="error" message={formError} style={styles.error} />
        <Pressable
          testID="submit-button"
          accessibilityRole="button"
          accessibilityLabel={FINISH_SETUP_CONTINUE}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={submit}
          style={[styles.submit, busy && styles.busy]}
        >
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitText}>{FINISH_SETUP_CONTINUE}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => services.repos.auth.signOut().catch((e: unknown) => console.warn('Could not sign out', e))}
          style={styles.signOut}
        >
          <Text style={styles.signOutText}>{SIGN_OUT_LABEL}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 28, textAlign: 'center', marginBottom: 32 },
  gap: { marginBottom: 16 },
  label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.elevated,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.background, fontSize: 14, fontWeight: '700' },
  checkLabel: { color: colors.text, flex: 1, fontSize: 14 },
  submit: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  busy: { opacity: 0.6 },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  signOut: { alignItems: 'center', paddingVertical: 16 },
  signOutText: { color: colors.accent, fontSize: 14 },
});
