import { Redirect, Stack, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { RepairDoneContext } from '@/features/auth/FinishSetupScreen';
import { needsRepair } from '@/features/auth/repairRegistration';
import { useSession } from '@/features/auth/useSession';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { PushBridge } from '@/features/push/PushBridge';
import { useEnsurePublicProfile } from '@/features/people/ensureProfile';
import { useServices } from '@/services/ServicesProvider';
import { colors } from '@/ui/theme';

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export default function AppLayout() {
  const services = useServices();
  const { status, session } = useSession();
  const segments = useSegments() as string[];
  const uid = session?.userId ?? null;
  // Whether this account still needs its users doc; keyed by uid so another account never inherits it.
  const [repair, setRepair] = useState<{ uid: string; needed: boolean } | null>(null);
  useEffect(() => {
    if (!uid || !session) return;
    let cancelled = false;
    needsRepair(services, session).then(
      (needed) => !cancelled && setRepair({ uid, needed }),
      // A failed read must not lock the person out; it is re-checked at the next session start.
      (e) => {
        console.warn('Could not check the account', e);
        if (!cancelled) setRepair({ uid, needed: false });
      },
    );
    return () => {
      cancelled = true;
    };
    // Only a new user id triggers a check; the completed repair reports through markRepaired.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, uid]);
  const markRepaired = useCallback(() => setRepair(uid ? { uid, needed: false } : null), [uid]);
  const checked = repair !== null && repair.uid === uid;
  // Accounts from before Plan 3 (or a half-finished registration) get their public profile here;
  // not before the users doc exists, or the fallback name would beat the one being entered.
  useEnsurePublicProfile(checked && !repair.needed ? session : null);

  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'loading' || !session || !checked) return <Loading />;
  if (repair.needed && !segments.includes('finish-setup')) return <Redirect href="/finish-setup" />;
  // The outbox processor runs only while signed in; unmounting on sign-out stops it.
  return (
    <OutboxProvider userId={session.userId}>
      <PushBridge uid={session.userId} />
      <BlocksProvider>
        <RepairDoneContext.Provider value={markRepaired}>
          <Stack screenOptions={{ headerShown: false }} />
        </RepairDoneContext.Provider>
      </BlocksProvider>
    </OutboxProvider>
  );
}
