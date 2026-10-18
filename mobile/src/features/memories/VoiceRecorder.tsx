import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

export const MAX_VOICE_SECONDS = 60;
const DENIED_COPY = 'Microphone permission is needed for voice notes.';
const ERROR_COPY = 'Could not record a voice note. Try again.';

type State =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'recording'; seconds: number }
  | { kind: 'ready'; seconds: number };

/** Records one voice note (max 60 s). Reports `{uri, durationMs}` when ready and `null` when removed. */
export function VoiceRecorder({ onChange }: { onChange: (r: { uri: string; durationMs: number } | null) => void }) {
  const { audioRecorder } = useServices();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const stopping = useRef(false);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  // Mirrors the native recorder: it is a process-wide singleton, so it must be stopped if we unmount mid-recording.
  const active = useRef<'starting' | 'recording' | null>(null);
  const unmounted = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (active.current === 'recording') {
        active.current = null;
        audioRecorder.stop().catch(() => {});
      }
      // 'starting': start() stops the recorder itself once it resolves.
    };
  }, [audioRecorder]);

  const stop = async () => {
    if (stopping.current) return;
    stopping.current = true;
    active.current = null;
    try {
      const result = await audioRecorder.stop();
      if (result) {
        setState({ kind: 'ready', seconds: Math.round(result.durationMs / 1000) });
        onChange(result);
      } else {
        setState({ kind: 'idle' });
      }
    } catch {
      setState({ kind: 'idle' });
      setError(ERROR_COPY);
    } finally {
      stopping.current = false;
    }
  };
  useEffect(() => {
    stopRef.current = stop;
  });

  const recording = state.kind === 'recording';
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const elapsed = Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - startedAt.current) / 1000));
      setState((s) => (s.kind === 'recording' ? { kind: 'recording', seconds: elapsed } : s));
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const seconds = state.kind === 'recording' ? state.seconds : 0;
  useEffect(() => {
    if (recording && seconds >= MAX_VOICE_SECONDS) void stopRef.current();
  }, [recording, seconds]);

  const start = async () => {
    setError(null);
    setState({ kind: 'starting' });
    active.current = 'starting';
    try {
      if ((await audioRecorder.requestPermission()) !== 'granted') {
        active.current = null;
        setState({ kind: 'idle' });
        setError(DENIED_COPY);
        return;
      }
      await audioRecorder.start();
      if (unmounted.current) {
        active.current = null;
        audioRecorder.stop().catch(() => {});
        return;
      }
      startedAt.current = Date.now();
      active.current = 'recording';
      setState({ kind: 'recording', seconds: 0 });
    } catch {
      active.current = null;
      setState({ kind: 'idle' });
      setError(ERROR_COPY);
    }
  };

  const remove = () => {
    setState({ kind: 'idle' });
    onChange(null);
  };

  return (
    <View style={styles.wrap}>
      {state.kind === 'idle' ? (
        <Pressable accessibilityRole="button" onPress={start} style={styles.row}>
          <Text style={styles.rowText}>Record voice note</Text>
        </Pressable>
      ) : null}
      {state.kind === 'starting' ? (
        <View style={[styles.row, styles.disabled]}>
          <Text style={styles.rowText}>Record voice note</Text>
        </View>
      ) : null}
      {state.kind === 'recording' ? (
        <View style={styles.row}>
          <Text style={styles.status}>{`Recording ${state.seconds}s / ${MAX_VOICE_SECONDS}s`}</Text>
          <Pressable accessibilityRole="button" onPress={stop}>
            <Text style={styles.rowText}>Stop</Text>
          </Pressable>
        </View>
      ) : null}
      {state.kind === 'ready' ? (
        <View style={styles.row}>
          <Text style={styles.status}>{`Voice note ready (${state.seconds}s)`}</Text>
          <Pressable accessibilityRole="button" onPress={remove}>
            <Text style={styles.rowText}>Remove voice note</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text role="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  row: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 8 },
  disabled: { opacity: 0.5 },
  rowText: { color: colors.accent, fontSize: 16 },
  status: { color: colors.text, fontSize: 16 },
  error: { color: colors.danger, marginTop: 8 },
});
