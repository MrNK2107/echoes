import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { searchRange } from '@/domain/communities';
import { MAX_TAGS, TAG_CAP_ERROR } from '@/domain/privacy';
import type { PublicProfile } from '@/domain/types';
import { useSession } from '@/features/auth/useSession';
import { useBlocks } from '@/features/safety/useBlocks';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { rememberName, useAuthorNames } from './useAuthorNames';

export const SEARCH_DEBOUNCE_MS = 300;
const MIN_LENGTH_HINT = 'Type at least 2 letters.';
const NO_RESULTS = 'No people found.';

type Results = { query: string; people: PublicProfile[] } | { query: string; error: true };

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** People never offered, e.g. a place's existing custodians. */
  excludeIds?: readonly string[];
}

/**
 * Finds people by display name and keeps the picked ones as removable chips. Never offers the
 * signed-in user, people they blocked, people already picked, or `excludeIds`.
 * testIDs: person-{uid}, chip-{uid}
 */
export function UserSearchField({ selectedIds, onChange, excludeIds = [] }: Props) {
  const { repos } = useServices();
  const { session } = useSession();
  const uid = session?.userId;
  const blocked = useBlocks();
  const names = useAuthorNames(selectedIds);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [capError, setCapError] = useState(false);

  const searchable = searchRange(query) !== null;

  useEffect(() => {
    if (!searchable) return;
    let active = true;
    const timer = setTimeout(() => {
      repos.profiles
        .search(query, { excludeUid: uid })
        .then((people) => {
          if (active) setResults({ query, people });
        })
        .catch((e: unknown) => {
          console.warn('People search failed', e);
          if (active) setResults({ query, error: true });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [repos.profiles, query, searchable, uid]);

  // Results for an older query are not shown while the new one is pending.
  const current = results && results.query === query ? results : null;
  const people =
    current && !('error' in current)
      ? current.people.filter(
          (p) => p.id !== uid && !blocked.has(p.id) && !selectedIds.includes(p.id) && !excludeIds.includes(p.id),
        )
      : null;

  const pick = (person: PublicProfile) => {
    if (selectedIds.length >= MAX_TAGS) {
      setCapError(true);
      return;
    }
    setCapError(false);
    rememberName(repos.profiles, person.id, person.displayName);
    setQuery('');
    setResults(null);
    onChange([...selectedIds, person.id]);
  };

  const remove = (id: string) => {
    setCapError(false);
    onChange(selectedIds.filter((s) => s !== id));
  };

  return (
    <View style={styles.container}>
      {selectedIds.length > 0 ? (
        <View style={styles.chips}>
          {selectedIds.map((id) => {
            const known = names.get(id);
            const name = known ?? '…';
            return (
              <View key={id} testID={`chip-${id}`} style={styles.chip}>
                <Text style={styles.chipText}>{name}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={known ? `Remove ${known}` : 'Remove tagged person'}
                  hitSlop={8}
                  onPress={() => remove(id)}
                >
                  <Text style={styles.chipRemove}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          setCapError(false);
        }}
        placeholder="Search people"
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel="Search people"
        autoCapitalize="words"
        autoCorrect={false}
      />

      {query.trim() !== '' && !searchable ? <Text style={styles.hint}>{MIN_LENGTH_HINT}</Text> : null}
      {current && 'error' in current ? <Text style={styles.error}>{GENERIC_ERROR}</Text> : null}
      {searchable && people && people.length === 0 ? <Text style={styles.hint}>{NO_RESULTS}</Text> : null}
      {searchable && people
        ? people.map((p) => (
            <Pressable
              key={p.id}
              testID={`person-${p.id}`}
              accessibilityRole="button"
              onPress={() => pick(p)}
              style={styles.result}
            >
              <Text style={styles.resultText}>{p.displayName}</Text>
            </Pressable>
          ))
        : null}
      {capError ? <Text style={styles.error}>{TAG_CAP_ERROR}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.elevated,
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  chipText: { color: colors.text },
  chipRemove: { color: colors.textSecondary, fontSize: 18, lineHeight: 18 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  hint: { color: colors.textSecondary, marginTop: 8 },
  error: { color: colors.danger, marginTop: 8 },
  result: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginTop: 6 },
  resultText: { color: colors.text, fontSize: 16 },
});
