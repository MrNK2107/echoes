import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/features/auth/useSession';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const { status } = useSession();
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
