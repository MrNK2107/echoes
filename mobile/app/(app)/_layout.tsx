import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/features/auth/useSession';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const { status, session } = useSession();
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'loading' || !session) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  // The outbox processor runs only while signed in; unmounting on sign-out stops it.
  return (
    <OutboxProvider userId={session.userId}>
      <Stack screenOptions={{ headerShown: false }} />
    </OutboxProvider>
  );
}
