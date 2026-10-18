import { useState, type ComponentProps } from 'react';
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

import { BAD_CREDENTIALS, EMAIL_IN_USE, GENERIC_ERROR } from '@/data/errors';
import { DEMO_USER } from '@/data/seed';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { validateDisplayName, validateEmail, validatePassword } from './validators';

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";
/** Domain messages the auth repositories throw on purpose; everything else is mapped to generic copy. */
const KNOWN_AUTH_MESSAGES = new Set([BAD_CREDENTIALS, EMAIL_IN_USE]);

function authErrorCopy(e: unknown): string {
  if (e instanceof Error && KNOWN_AUTH_MESSAGES.has(e.message)) return e.message;
  console.warn('Auth request failed', e);
  const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: unknown }).code : null;
  return code === 'auth/network-request-failed' ? NETWORK_ERROR : GENERIC_ERROR;
}

type Errors = { email?: string; password?: string; name?: string; age?: string };

export function SignInScreen() {
  const { repos, config } = useServices();
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [ageOk, setAgeOk] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const register = mode === 'register';

  const toggleMode = () => {
    setMode(register ? 'signIn' : 'register');
    setErrors({});
    setFormError(null);
  };

  const submit = async () => {
    if (busy) return;
    const next: Errors = {};
    const emailErr = validateEmail(email);
    const passErr = validatePassword(password);
    if (emailErr) next.email = emailErr;
    if (passErr) next.password = passErr;
    if (register) {
      const nameErr = validateDisplayName(name);
      if (nameErr) next.name = nameErr;
      if (!ageOk) next.age = 'You must be at least 13 to create an account.';
    }
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      if (register) await repos.auth.register(email.trim(), password, name.trim());
      else await repos.auth.signIn(email.trim(), password);
    } catch (e) {
      setFormError(authErrorCopy(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>ECHOES</Text>

        {register && (
          <Field
            label="Name"
            testID="name-input"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
          />
        )}
        <Field
          label="Email"
          testID="email-input"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          testID="password-input"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
        />

        {register && (
          <View style={styles.fieldGap}>
            <Pressable
              testID="age-checkbox"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ageOk }}
              onPress={() => setAgeOk(!ageOk)}
              style={styles.checkRow}
            >
              <View style={[styles.box, ageOk && styles.boxChecked]}>
                {ageOk && <Text style={styles.tick}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>I confirm that I am at least 13 years old.</Text>
            </Pressable>
            {errors.age ? <Text style={styles.error}>{errors.age}</Text> : null}
          </View>
        )}

        {formError ? (
          <Text role="alert" style={styles.error}>
            {formError}
          </Text>
        ) : null}

        <Pressable
          testID="submit-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={submit}
          style={[styles.submit, busy && styles.submitBusy]}
        >
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.submitText}>{register ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <Pressable testID="mode-toggle" accessibilityRole="button" onPress={toggleMode} style={styles.toggle}>
          <Text style={styles.toggleText}>{register ? 'I already have an account' : 'Create an account'}</Text>
        </Pressable>

        {config.backend === 'memory' && (
          <Text style={styles.hint}>
            Demo: {DEMO_USER.email} / {DEMO_USER.password}
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, error, ...input }: { label: string; error?: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldGap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const ERROR = colors.danger;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { color: colors.text, fontSize: 32, letterSpacing: 6, textAlign: 'center', marginBottom: 32 },
  fieldGap: { marginBottom: 16 },
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
  inputError: { borderColor: ERROR },
  error: { color: ERROR, fontSize: 13, marginTop: 6 },
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
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBusy: { opacity: 0.6 },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  toggle: { alignItems: 'center', paddingVertical: 16 },
  toggleText: { color: colors.accent, fontSize: 14 },
  hint: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
