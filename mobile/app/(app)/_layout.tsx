import { Redirect, Stack, useSegments } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

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
  // Whether this account still needs its users doc; keyed by uid so another account never inherits
  // it. Unknown until the read answers: the app opens at once and redirects only on a confirmed gap.
  const [repair, setRepair] = useState<{ uid: string; needed: boolean } | null>(null);
  useEffect(() => {
    if (!uid || !session) return;
    let cancelled = false;
    let retried = false;
    let sub: { remove(): void } | null = null;
    const check = () => {
      needsRepair(services, session).then(
        (needed) => {
          if (cancelled) return;
          sub?.remove();
          sub = null;
          setRepair({ uid, needed });
        },
        (e) => {
          console.warn('Could not check the account', e);
          if (cancelled || retried) return;
          retried = true;
          // One retry when the app comes back to the foreground; until then it simply stays open.
          sub = AppState.addEventListener('change', (next) => {
            if (next !== 'active') return;
            sub?.remove();
            sub = null;
            check();
          });
        },
      );
    };
    check();
    return () => {
      cancelled = true;
      sub?.remove();
    };
    // Only a new user id triggers a check; the completed repair reports through markRepaired.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, uid]);
  const markRepaired = useCallback(() => setRepair(uid ? { uid, needed: false } : null), [uid]);
  const known = repair !== null && repair.uid === uid ? repair : null;
  // Accounts from before Plan 3 (or a half-finished registration) get their public profile here;
  // not before the users doc is known to exist, or the fallback name would beat the one being entered.
  useEnsurePublicProfile(known && !known.needed ? session : null);

  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (status === 'loading' || !session) return <Loading />;
  const onFinish = segments.includes('finish-setup');
  if (known?.needed && !onFinish) return <Redirect href="/finish-setup" />;
  // An account that is already set up must never reach the form: Continue would be a stray write.
  if (known && !known.needed && onFinish) return <Redirect href="/" />;
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
