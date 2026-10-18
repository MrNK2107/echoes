import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioPlayerHandle } from '@/device/types';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

/** Plays a memory's voice note; the player is released on unmount. */
export function VoiceNotePlayer({ url }: { url: string }) {
  const { audioPlayer } = useServices();
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const handle = useRef<AudioPlayerHandle | null>(null);

  useEffect(() => {
    const h = audioPlayer.load(url);
    const off = h.onStatus((s) => {
      if (s.error) {
        setFailed(true);
        setPlaying(false);
      } else setPlaying(s.finished ? false : s.playing);
    });
    handle.current = h;
    return () => {
      off();
      h.release();
      handle.current = null;
    };
  }, [audioPlayer, url]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Voice note</Text>
      {failed ? (
        <Text style={styles.error}>Voice note unavailable</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
          onPress={() => (playing ? handle.current?.pause() : handle.current?.play())}
        >
          <Text style={styles.action}>{playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  label: { color: colors.text, fontSize: 16 },
  action: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  error: { color: colors.danger },
});
