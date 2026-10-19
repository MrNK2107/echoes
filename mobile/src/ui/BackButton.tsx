import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BACK_LABEL, BACK_TEXT } from './copy';
import { colors } from './theme';

/** Shared back control: clears the status bar/notch and keeps a 44dp touch target. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View testID="back-wrapper" style={{ paddingTop: insets.top }}>
      <Pressable
        testID="back-button"
        accessibilityRole="button"
        accessibilityLabel={BACK_LABEL}
        onPress={onPress ?? (() => router.back())}
        style={styles.button}
      >
        <Text style={styles.text}>{BACK_TEXT}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  text: { color: colors.accent, fontSize: 16 },
});
