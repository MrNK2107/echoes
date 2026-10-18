import { Redirect } from 'expo-router';

import { SignInScreen } from '@/features/auth/SignInScreen';
import { useSession } from '@/features/auth/useSession';

export default function SignInRoute() {
  const { status } = useSession();
  if (status === 'signedIn') return <Redirect href="/" />;
  return <SignInScreen />;
}
