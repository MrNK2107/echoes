import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import type { ReportReason } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

/** The reportMemory callable's note limit (functions/safety.js). */
export const REPORT_NOTE_MAX = 280;
export const REPORT_THANKS = "Thanks — we'll review it.";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'other', label: 'Something else' },
];

interface Props {
  visible: boolean;
  memoryId: string;
  onClose: () => void;
  /** Called once the server accepted the report; the caller shows the thanks. */
  onReported: () => void;
}

/** The repository rejects with user-facing copy (REPORT_DUPLICATE, REPORT_RATE, timeout, generic). */
const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : GENERIC_ERROR);

export function ReportSheet({ visible, memoryId, onClose, onReported }: Props) {
  const { repos } = useServices();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const reset = () => {
    setReason(null);
    setNote('');
    setError(null);
  };

  const close = () => {
    if (sendingRef.current) return;
    reset();
    onClose();
  };

  const send = async () => {
    if (sendingRef.current || !reason) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      await repos.safety.reportMemory({ memoryId, reason, note: note.trim() || null });
      reset();
      onReported();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const disabled = !reason || sending;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>
            Why are you reporting this?
          </Text>

          <View accessibilityRole="radiogroup" accessibilityLabel="Why are you reporting this?">
            {REPORT_REASONS.map((r) => {
              const checked = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  accessibilityRole="radio"
                  accessibilityLabel={r.label}
                  accessibilityState={{ checked }}
                  onPress={() => setReason(r.value)}
                  style={styles.reason}
                >
                  <View style={[styles.dot, checked && styles.dotOn]} />
                  <Text style={styles.reasonText}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            accessibilityLabel="Add details (optional)"
            placeholder="Add details (optional)"
            placeholderTextColor={colors.textSecondary}
            value={note}
            onChangeText={setNote}
            maxLength={REPORT_NOTE_MAX}
            multiline
            style={styles.input}
          />
          <Text style={styles.counter}>{`${note.length}/${REPORT_NOTE_MAX}`}</Text>

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
              accessibilityLabel="Send report"
              accessibilityState={{ disabled, busy: sending }}
              disabled={disabled}
              onPress={() => void send()}
              style={[styles.primary, disabled && styles.disabled]}
            >
              {sending ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryText}>Send report</Text>
              )}
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
  reason: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, minHeight: 44 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textSecondary },
  dotOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  reasonText: { color: colors.text, fontSize: 16 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.elevated,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  counter: { color: colors.textSecondary, alignSelf: 'flex-end', marginTop: 4 },
  error: { color: colors.danger, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  primary: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, minWidth: 120, alignItems: 'center' },
  primaryText: { color: colors.background, fontWeight: '600' },
  secondary: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
