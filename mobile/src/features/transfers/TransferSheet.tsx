import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageOf } from '@/data/errors';
import type { Place } from '@/domain/types';
import { UserSearchField } from '@/features/people/UserSearchField';
import { useServices } from '@/services/ServicesProvider';
import { REMOVE_PERSON_LABEL } from '@/ui/copy';
import { colors } from '@/ui/theme';

export const REQUEST_SENT = 'Request sent.';

interface Props {
  place: Place;
  visible: boolean;
  onClose: () => void;
  /** Called after the request was sent; the sheet has already reset. */
  onSent: () => void;
}

/**
 * Picks one person (never yourself, people you blocked, or an existing custodian) and sends them
 * a custodianship request for the place.
 */
export function TransferSheet({ place, visible, onClose, onSent }: Props) {
  const insets = useSafeAreaInsets();
  const { repos } = useServices();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSelected([]);
    setError(null);
  };

  const close = () => {
    if (sendingRef.current) return;
    reset();
    onClose();
  };

  const send = async () => {
    const toUserId = selected[0];
    if (sendingRef.current || !toUserId) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      await repos.transfers.initiate({ placeId: place.id, toUserId });
      reset();
      onSent();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const disabled = sending || selected.length === 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: 16 + Math.max(insets.bottom, 16) }]}>
          <Text accessibilityRole="header" style={styles.title}>
            Choose the new custodian
          </Text>
          <UserSearchField
            removeFallbackLabel={REMOVE_PERSON_LABEL}
            selectedIds={selected}
            // One recipient: picking someone else replaces the current pick.
            onChange={(ids) => {
              setSelected(ids.slice(-1));
              setError(null);
            }}
            excludeIds={place.custodianIds}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: sending }}
              disabled={sending}
              onPress={close}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled, busy: sending }}
              disabled={disabled}
              onPress={() => void send()}
              style={[styles.primary, disabled && styles.disabled]}
            >
              <Text style={styles.primaryText}>Send request</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  title: { color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 12 },
  error: { color: colors.danger, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  primary: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  primaryText: { color: colors.background, fontWeight: '600' },
  secondary: { borderColor: colors.accent, borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
