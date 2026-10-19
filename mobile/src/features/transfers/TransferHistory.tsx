import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import type { Transfer } from '@/data/types';
import { useSession } from '@/features/auth/useSession';
import { useAuthorNames } from '@/features/people/useAuthorNames';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

import { usePlaceNames, useTransferHistory } from './useTransfers';

export const TRANSFER_REVOKED = 'Transfer revoked.';
const EMPTY = 'No transfers yet.';
const LOAD_ERROR = "Couldn't load transfers.";
const STATUS_LABEL: Record<Transfer['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Declined',
  revoked: 'Revoked',
  expired: 'Expired',
};

/** The repository rejects with user-facing copy (generic or offline for revokeTransfer). */
const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : GENERIC_ERROR);

/** The sender may revoke a pending or accepted transfer until revokeUntil (inclusive). */
export function canRevoke(t: Transfer, uid: string, now: Date): boolean {
  return (
    t.fromUserId === uid &&
    (t.status === 'pending' || t.status === 'accepted') &&
    now.getTime() <= t.revokeUntil.getTime()
  );
}

/** The signed-in user's sent and received transfers. testIDs: transfer-{id}, revoke-{id} */
export function TransferHistory() {
  const { repos, now } = useServices();
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const history = useTransferHistory();
  const placeIds = useMemo(() => history.items.map((t) => t.placeId), [history.items]);
  const placeNames = usePlaceNames(placeIds);
  const otherIds = useMemo(
    () => history.items.map((t) => (t.fromUserId === uid ? t.toUserId : t.fromUserId)),
    [history.items, uid],
  );
  const names = useAuthorNames(otherIds);
  const [revoking, setRevoking] = useState<string | null>(null);
  const revokingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const revoke = async (id: string) => {
    if (revokingRef.current) return;
    revokingRef.current = true;
    setRevoking(id);
    setError(null);
    setNotice(null);
    try {
      await repos.transfers.revoke(id);
      setNotice(TRANSFER_REVOKED);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      revokingRef.current = false;
      setRevoking(null);
    }
  };

  const at = now();

  return (
    <View>
      <Text accessibilityRole="header" style={styles.section}>
        Transfer history
      </Text>
      {notice ? (
        <Text role="status" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {history.error ? <Text style={styles.meta}>{LOAD_ERROR}</Text> : null}
      {history.loaded && history.items.length === 0 ? <Text style={styles.meta}>{EMPTY}</Text> : null}
      {history.items.map((t) => {
        const sent = t.fromUserId === uid;
        const otherId = sent ? t.toUserId : t.fromUserId;
        const other = names.get(otherId) ?? '…';
        const line = `${sent ? 'To' : 'From'} ${other} · ${STATUS_LABEL[t.status]}`;
        const busy = revoking !== null;
        return (
          <View key={t.id} testID={`transfer-${t.id}`} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.place}>{placeNames.get(t.placeId) ?? '…'}</Text>
              <Text style={styles.meta}>{line}</Text>
            </View>
            {uid && canRevoke(t, uid, at) ? (
              <Pressable
                testID={`revoke-${t.id}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy: revoking === t.id }}
                disabled={busy}
                onPress={() => void revoke(t.id)}
                style={[styles.revoke, busy && styles.disabled]}
              >
                <Text style={styles.revokeText}>Revoke</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  notice: { color: colors.textSecondary, marginVertical: 4 },
  error: { color: colors.danger, marginVertical: 4 },
  meta: { color: colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 8 },
  rowBody: { flex: 1 },
  place: { color: colors.text, fontSize: 16 },
  revoke: { borderColor: colors.danger, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  revokeText: { color: colors.danger, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
