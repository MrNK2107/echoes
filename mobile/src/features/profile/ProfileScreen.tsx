import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppUser, Memory } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { MemoryCard } from '@/features/places/MemoryCard';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

/** subscribeForUser returns at most this many memories. */
const LIMIT = 50;
const GENERIC = 'Something went wrong. Please try again.';
type DefaultPrivacy = 'public' | 'private';
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
  const [memories, setMemories] = useState<Memory[]>([]);
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
        if (!cancelled) setError(GENERIC);
      });
    return () => {
      cancelled = true;
    };
  }, [repos.users, uid]);

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
        setError(GENERIC);
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
      setError(GENERIC);
    }
  };

  const signOut = async () => {
    try {
      await repos.auth.signOut();
    } catch {
      setError(GENERIC);
    }
  };

  const name = (user ? user.displayName : session?.displayName) || 'ECHOES custodian';
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
  emptyBox: { alignItems: 'center', padding: 16, gap: 4 },
  emptyTitle: { color: colors.text, fontSize: 16 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  rowText: { color: colors.accent, fontSize: 16 },
  dangerText: { color: colors.danger, fontSize: 16 },
});
