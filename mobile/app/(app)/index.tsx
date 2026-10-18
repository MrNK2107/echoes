import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/ui/theme';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ECHOES</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 32, letterSpacing: 6 },
});
