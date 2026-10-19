import { Redirect } from 'expo-router';

import { FinishSetupScreen } from '@/features/auth/FinishSetupScreen';
import { useSession } from '@/features/auth/useSession';

export default function FinishSetupRoute() {
  const { status, session } = useSession();
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (!session) return null;
  return <FinishSetupScreen session={session} />;
}
