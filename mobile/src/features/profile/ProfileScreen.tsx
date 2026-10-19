import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { CUSTODIAN_FALLBACK_NAME, DISPLAY_NAME_ERROR, validateDisplayName } from '@/domain/profiles';
import type { AppUser, Memory, NotificationPrefs } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { rememberName } from '@/features/people/useAuthorNames';
import { MemoryCard } from '@/features/places/MemoryCard';
import { useBlocks, withoutBlocked } from '@/features/safety/useBlocks';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

/** subscribeForUser returns at most this many memories. */
const LIMIT = 50;
type DefaultPrivacy = 'public' | 'private';
const PREF_TOGGLES: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'transfers', label: 'Custodianship requests' },
  { key: 'tags', label: 'Tags' },
  { key: 'communityInvites', label: 'Community invitations' },
];
const CHOICES: { value: DefaultPrivacy; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

/** testIDs: default-privacy-{public|private} */
export function ProfileScreen() {
  const router = useRouter();
  const { repos, now } = useServices();
  const { session } = useSession();
  const uid = session?.userId;
  const [user, setUser] = useState<AppUser | null>(null);
  const [ownMemories, setMemories] = useState<Memory[]>([]);
  const blocked = useBlocks();
  // Own memories are never by a blocked author; the filter keeps every memory list consistent (R20).
  const memories = useMemo(() => withoutBlocked(ownMemories, blocked), [ownMemories, blocked]);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [privacy, setPrivacy] = useState<DefaultPrivacy>('public');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    repos.users
      .get(uid)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setPrivacy(u?.defaultPrivacy === 'private' ? 'private' : 'public');
      })
      .catch(() => {
        if (!cancelled) setError(GENERIC_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [repos.users, uid]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    repos.profiles
      .get(uid)
      .then((p) => {
        if (!cancelled && p) setNameDraft((d) => d ?? p.displayName);
      })
      .catch((e: unknown) => console.warn('Could not load the public profile', e));
    return () => {
      cancelled = true;
    };
  }, [repos.profiles, uid]);

  useEffect(() => {
    if (!uid) return;
    return repos.memories.subscribeForUser(
      uid,
      (list) => {
        setMemories(list);
        setLoaded(true);
      },
      () => {
        setLoaded(true);
        setError(GENERIC_ERROR);
      },
    );
  }, [repos.memories, uid]);

  const choosePrivacy = async (next: DefaultPrivacy) => {
    if (!uid || !user || next === privacy) return;
    const previous = privacy;
    setPrivacy(next);
    setError(null);
    try {
      await repos.users.updateDefaultPrivacy(uid, next, now());
    } catch {
      setPrivacy(previous);
      setError(GENERIC_ERROR);
    }
  };

  const prefs: NotificationPrefs = user?.notificationPrefs ?? { transfers: true, tags: true, communityInvites: true };
  const togglePref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!uid || !user) return;
    const previous = user.notificationPrefs;
    const next = { ...prefs, [key]: value };
    setUser((u) => (u ? { ...u, notificationPrefs: next } : u));
    setError(null);
    try {
      await repos.users.updateNotificationPrefs(uid, next, now());
    } catch {
      setUser((u) => (u ? { ...u, notificationPrefs: previous } : u));
      setError(GENERIC_ERROR);
    }
  };

  const saveName = async () => {
    if (!uid || savingName) return;
    const draft = nameDraft ?? '';
    const invalid = validateDisplayName(draft);
    if (invalid) {
      setNameError(invalid);
      return;
    }
    const next = draft.trim();
    setNameError(null);
    setSavingName(true);
    try {
      await repos.profiles.setDisplayName(uid, next, now());
      rememberName(repos.profiles, uid, next);
      setNameDraft(next);
      setUser((u) => (u ? { ...u, displayName: next } : u));
    } catch (e) {
      setNameError(e instanceof Error && e.message === DISPLAY_NAME_ERROR ? DISPLAY_NAME_ERROR : GENERIC_ERROR);
    } finally {
      setSavingName(false);
    }
  };

  const signOut = async () => {
    try {
      await repos.auth.signOut();
    } catch {
      setError(GENERIC_ERROR);
    }
  };

  const name = (user ? user.displayName : session?.displayName) || CUSTODIAN_FALLBACK_NAME;
  const email = (user ? user.email : session?.email) ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        Profile
      </Text>
      <Text style={styles.name}>{name}</Text>
      {email ? <Text style={styles.meta}>{email}</Text> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Text style={styles.section}>Display name</Text>
      <TextInput
        style={[styles.input, nameError ? styles.inputError : null]}
        value={nameDraft ?? ''}
        onChangeText={(t) => {
          setNameDraft(t);
          setNameError(null);
        }}
        accessibilityLabel="Display name"
        autoCapitalize="words"
        placeholderTextColor={colors.textSecondary}
      />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: savingName, busy: savingName }}
        disabled={savingName}
        onPress={saveName}
        style={[styles.row, savingName && styles.disabled]}
      >
        <Text style={styles.rowText}>Save name</Text>
      </Pressable>

      <View style={styles.stat}>
        <Text style={styles.statValue}>{memories.length >= LIMIT ? `${LIMIT}+` : String(memories.length)}</Text>
        <Text style={styles.meta}>Memories</Text>
      </View>

      <Text style={styles.section}>Default privacy for new memories</Text>
      <View style={styles.segmented}>
        {CHOICES.map((c) => (
          <Pressable
            key={c.value}
            testID={`default-privacy-${c.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: privacy === c.value, disabled: !user }}
            disabled={!user}
            onPress={() => choosePrivacy(c.value)}
            style={[styles.segment, privacy === c.value && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, privacy === c.value && styles.segmentTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Notifications</Text>
      {PREF_TOGGLES.map((t) => (
        <View key={t.key} style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t.label}</Text>
          <Switch
            accessibilityLabel={t.label}
            value={prefs[t.key]}
            disabled={!user}
            onValueChange={(v) => togglePref(t.key, v)}
          />
        </View>
      ))}

      <Text style={styles.section}>Your memories</Text>
      {memories.map((m) => (
        <MemoryCard key={m.id} memory={m} />
      ))}
      {loaded && memories.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No memories yet.</Text>
          <Text style={styles.meta}>Memories you leave will appear here.</Text>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push('/recently-deleted')} style={styles.row}>
        <Text style={styles.rowText}>Recently deleted</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={signOut} style={styles.row}>
        <Text style={styles.rowText}>Sign out</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} style={styles.row}>
        <Text style={styles.dangerText}>Delete account</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  back: { paddingTop: 32, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  name: { color: colors.text, fontSize: 20, fontWeight: '600' },
  meta: { color: colors.textSecondary },
  error: { color: colors.danger, marginVertical: 8 },
  stat: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginVertical: 16, alignItems: 'center' },
  statValue: { color: colors.gold, fontSize: 28, fontWeight: '700' },
  section: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  segmented: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segment: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: 12, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { color: colors.text },
  segmentTextOn: { color: colors.background, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleLabel: { color: colors.text, fontSize: 16 },
  emptyBox: { alignItems: 'center', padding: 16, gap: 4 },
  emptyTitle: { color: colors.text, fontSize: 16 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  rowText: { color: colors.accent, fontSize: 16 },
  dangerText: { color: colors.danger, fontSize: 16 },
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
  disabled: { opacity: 0.5 },
});
