import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Institution } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { RegisterInstitutionSheet } from './RegisterInstitutionSheet';

type ListState = { status: 'loading' | 'ready' | 'error'; institutions: Institution[] };

/** testIDs: institution-row-{id} */
export function InstitutionsScreen() {
  const router = useRouter();
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const [list, setList] = useState<ListState>({ status: 'loading', institutions: [] });
  const [staff, setStaff] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return repos.institutions.subscribeAll(
      (institutions) => setList({ status: 'ready', institutions }),
      (e) => {
        console.warn('Could not load institutions', e);
        setList({ status: 'error', institutions: [] });
      },
    );
  }, [repos.institutions, uid]);

  // `Register institution` follows the `staff` claim; re-checked whenever the screen gains focus,
  // so a claim granted while the app is open shows up without signing out.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let active = true;
      repos.auth
        .refreshUser()
        .then((s) => {
          if (active) setStaff(s.staff);
        })
        .catch((e: unknown) => console.warn('Could not refresh the account', e));
      return () => {
        active = false;
      };
    }, [repos.auth, uid]),
  );

  const open = (id: string) => router.push(`/institutions/${id}`);

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </Pressable>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Institutions
        </Text>
        {staff ? (
          <Pressable accessibilityRole="button" onPress={() => setRegistering(true)} style={styles.create}>
            <Text style={styles.createText}>Register institution</Text>
          </Pressable>
        ) : null}
      </View>

      {list.status === 'loading' ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
      {list.status === 'error' ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {"Couldn't load institutions."}
        </Text>
      ) : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={list.institutions}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          list.status === 'ready' ? <Text style={styles.message}>No institutions yet.</Text> : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`institution-row-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => open(item.id)}
            style={styles.row}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.allowedEmailDomains.join(', ')}</Text>
          </Pressable>
        )}
      />

      <RegisterInstitutionSheet
        visible={registering}
        onClose={() => setRegistering(false)}
        onCreated={(id) => {
          setRegistering(false);
          open(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  back: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  create: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  createText: { color: colors.background, fontWeight: '600' },
  list: { padding: 16 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textSecondary, marginTop: 4 },
  spinner: { marginTop: 16 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
});
