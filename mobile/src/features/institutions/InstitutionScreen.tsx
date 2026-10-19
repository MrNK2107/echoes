import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR, messageOf, VERIFY_EMAIL_FIRST } from '@/data/errors';
import type { Institution } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { LOCATION_FAILED, NAME_REQUIRED } from '@/ui/copy';
import { Notice } from '@/ui/Notice';
import { BackButton } from '@/ui/BackButton';
import { colors } from '@/ui/theme';

const SUB_ZONE_NAME_MAX = 60;
const LOCATION_PERMISSION = 'Location permission is needed to add a sub-zone here.';

type LoadState =
  | { status: 'loading' | 'notFound' | 'error'; institution: null }
  | { status: 'ready'; institution: Institution };

/** The institution as a load state; null when the read failed (the caller keeps what it shows). */
async function readInstitution(
  find: (id: string) => Promise<Institution | null>,
  id: string,
): Promise<LoadState | null> {
  try {
    const institution = await find(id);
    return institution ? { status: 'ready', institution } : { status: 'notFound', institution: null };
  } catch (e) {
    console.warn('Could not load the institution', e);
    return null;
  }
}

const keepOrFail = (next: LoadState | null) => (s: LoadState): LoadState =>
  next ?? (s.status === 'ready' ? s : { status: 'error', institution: null });

export function InstitutionScreen({ institutionId }: { institutionId: string }) {
  const services = useServices();
  const { repos } = services;
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [state, setState] = useState<LoadState>({ status: 'loading', institution: null });
  const [email, setEmail] = useState<string | null>(null);
  /** The last claim said the email is unverified; cleared once a refresh sees it verified. */
  const [verifyPrompt, setVerifyPrompt] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneNameMissing, setZoneNameMissing] = useState(false);

  const load = useCallback(async () => {
    const next = await readInstitution((id) => repos.institutions.findById(id), institutionId);
    setState(keepOrFail(next));
  }, [repos.institutions, institutionId]);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    void readInstitution((id) => repos.institutions.findById(id), institutionId).then((next) => {
      if (active) setState(keepOrFail(next));
    });
    return () => {
      active = false;
    };
  }, [repos.institutions, institutionId, uid]);

  // The admin list is private: the screen only learns whether the signed-in user is an admin.
  // The value is keyed by institution and user, so it never carries over when either changes
  // (or when the user signs out): a stale key reads as "not an admin" until the new one reports.
  const adminKey = uid === null ? null : `${institutionId}:${uid}`;
  const [adminState, setAdminState] = useState<{ key: string; isAdmin: boolean } | null>(null);
  const isAdmin = adminKey !== null && adminState?.key === adminKey && adminState.isAdmin;
  useEffect(() => {
    if (!uid || adminKey === null) return;
    return repos.institutions.subscribeIsAdmin(
      institutionId,
      uid,
      (value) => setAdminState({ key: adminKey, isAdmin: value }),
      (e) => console.warn('Could not read the admin role', e),
    );
  }, [repos.institutions, institutionId, uid, adminKey]);

  /** Re-reads the account (verified email, fresh token); a verified email clears the prompt. */
  const recheckAccount = useCallback(async () => {
    try {
      const account = await repos.auth.refreshUser();
      setEmail(account.email);
      if (account.emailVerified) setVerifyPrompt(false);
    } catch (e) {
      console.warn('Could not refresh the account', e);
    }
  }, [repos.auth]);

  // Coming back to this screen re-reads the account and the institution (admins and sub-zones may
  // have changed).
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      if (focusedOnce.current) void load();
      focusedOnce.current = true;
      void recheckAccount();
    }, [load, recheckAccount, uid]),
  );

  // Returning to the app (e.g. from the mail app after tapping the verification link) does not
  // refocus the screen, so the account is also re-read whenever the app becomes active.
  useEffect(() => {
    if (!uid) return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void recheckAccount();
    });
    return () => subscription.remove();
  }, [recheckAccount, uid]);

  /** Runs one action at a time; the busy flag disables every action button. */
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const back = (
    <BackButton />
  );

  if (state.status !== 'ready') {
    return (
      <View style={styles.container}>
        {back}
        <View style={styles.center}>
          {state.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
          {state.status === 'notFound' ? <Text style={styles.message}>This institution no longer exists.</Text> : null}
          {state.status === 'error' ? <Text style={styles.message}>{"Couldn't load this institution."}</Text> : null}
        </View>
      </View>
    );
  }

  const { institution } = state;

  const claim = () =>
    run(async () => {
      try {
        await repos.institutions.claimAdmin(institution.id);
        setVerifyPrompt(false);
        await load();
        setNotice(`You're now an admin of ${institution.name}.`);
      } catch (e) {
        const message = messageOf(e);
        if (message === VERIFY_EMAIL_FIRST) {
          setVerifyPrompt(true);
        } else {
          setVerifyPrompt(false);
          setError(message);
        }
      }
    });

  const sendVerification = () =>
    run(async () => {
      try {
        await repos.auth.sendEmailVerification();
        setNotice(`Verification email sent to ${email ?? session?.email ?? ''}.`);
      } catch (e) {
        // Auth SDK errors are not user copy; never show them raw.
        console.warn('Could not send the verification email', e);
        setError(GENERIC_ERROR);
      }
    });

  const addSubZone = () =>
    run(async () => {
      const name = zoneName.trim();
      setZoneNameMissing(name === '');
      if (name === '') return;
      let position;
      try {
        if ((await services.location.requestPermission()) !== 'granted') {
          setError(LOCATION_PERMISSION);
          return;
        }
        position = await services.location.getCurrentPosition();
      } catch {
        setError(LOCATION_FAILED);
        return;
      }
      try {
        await repos.institutions.addSubZone(institution.id, {
          name,
          latitude: position.latitude,
          longitude: position.longitude,
        });
        setZoneName('');
        await load();
        setNotice('Sub-zone added.');
      } catch (e) {
        setError(messageOf(e));
      }
    });

  return (
    <View style={styles.container}>
      {back}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          {institution.name}
        </Text>
        <Text style={styles.label}>Approved email domains</Text>
        <Text style={styles.meta}>{institution.allowedEmailDomains.join(', ')}</Text>

        <Notice message={notice} style={styles.notice} />
        <Notice tone="error" message={error} style={styles.error} />

        {isAdmin ? null : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => void claim()}
              style={[styles.primary, busy && styles.disabled]}
            >
              <Text style={styles.primaryText}>Verify as admin</Text>
            </Pressable>
            <Notice tone="error" message={verifyPrompt ? VERIFY_EMAIL_FIRST : null} style={styles.error} />
            {verifyPrompt ? (
              <View style={styles.prompt}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => void sendVerification()}
                  style={[styles.secondary, busy && styles.disabled]}
                >
                  <Text style={styles.secondaryText}>Send verification email</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        <Text accessibilityRole="header" style={styles.section}>
          Sub-zones
        </Text>
        {institution.subZones.length === 0 ? <Text style={styles.meta}>No sub-zones yet.</Text> : null}
        {institution.subZones.map((z) => (
          <View key={z.id} style={styles.row}>
            <Text style={styles.rowText}>{z.name}</Text>
          </View>
        ))}

        {isAdmin ? (
          <View style={styles.zoneForm}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              accessibilityLabel="Name"
              value={zoneName}
              onChangeText={(t) => {
                setZoneName(t);
                setZoneNameMissing(false);
              }}
              maxLength={SUB_ZONE_NAME_MAX}
              style={[styles.input, zoneNameMissing && styles.inputError]}
              placeholderTextColor={colors.textSecondary}
            />
            {zoneNameMissing ? <Text style={styles.error}>{NAME_REQUIRED}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => void addSubZone()}
              style={[styles.primary, busy && styles.disabled]}
            >
              <Text style={styles.primaryText}>Add sub-zone here</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600', marginBottom: 8 },
  label: { color: colors.textSecondary, marginTop: 8, marginBottom: 4 },
  meta: { color: colors.textSecondary },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
  notice: { color: colors.gold, marginTop: 12 },
  error: { color: colors.danger, marginTop: 8 },
  prompt: { marginTop: 8 },
  section: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  rowText: { color: colors.text, fontSize: 16 },
  zoneForm: { marginTop: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.elevated,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  primary: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 },
  primaryText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  secondary: { borderRadius: 12, borderWidth: 1, borderColor: colors.accent, padding: 12, alignItems: 'center', marginTop: 8 },
  secondaryText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
