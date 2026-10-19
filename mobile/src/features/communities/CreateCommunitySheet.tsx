import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

const NAME_MAX = 60;
const DESCRIPTION_MAX = 500;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called with the new community's id once the server has created it. */
  onCreated: (id: string) => void;
}

/** The repository rejects with user-facing copy (callable errors are mapped there). */
const messageOf = (e: unknown) => (e instanceof Error && e.message ? e.message : GENERIC_ERROR);

export function CreateCommunitySheet({ visible, onClose, onCreated }: Props) {
  const { repos } = useServices();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const nameMissing = name.trim() === '';
  const descriptionMissing = description.trim() === '';

  const reset = () => {
    setName('');
    setDescription('');
    setSubmitted(false);
    setError(null);
  };

  const close = () => {
    if (savingRef.current) return;
    reset();
    onClose();
  };

  const create = async () => {
    if (savingRef.current) return;
    setSubmitted(true);
    if (nameMissing || descriptionMissing) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const id = await repos.communities.create({ name: name.trim(), description: description.trim() });
      reset();
      onCreated(id);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>
            Create community
          </Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            accessibilityLabel="Name"
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX}
            style={[styles.input, submitted && nameMissing && styles.inputError]}
            placeholderTextColor={colors.textSecondary}
          />
          {submitted && nameMissing ? <Text style={styles.error}>Name is required</Text> : null}

          <Text style={styles.label}>Description</Text>
          <TextInput
            accessibilityLabel="Description"
            value={description}
            onChangeText={setDescription}
            maxLength={DESCRIPTION_MAX}
            multiline
            style={[styles.input, styles.multiline, submitted && descriptionMissing && styles.inputError]}
            placeholderTextColor={colors.textSecondary}
          />
          {submitted && descriptionMissing ? <Text style={styles.error}>Description is required</Text> : null}

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={close}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create"
              accessibilityState={{ busy: saving }}
              onPress={() => void create()}
              style={[styles.primary, saving && styles.disabled]}
            >
              {saving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryText}>Create</Text>}
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
  label: { color: colors.textSecondary, marginTop: 8, marginBottom: 4 },
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
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  primary: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, minWidth: 96, alignItems: 'center' },
  primaryText: { color: colors.background, fontWeight: '600' },
  secondary: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
