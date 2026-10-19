import { useLocalSearchParams } from 'expo-router';

import { CommunityScreen } from '@/features/communities/CommunityScreen';

export default function CommunityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CommunityScreen communityId={id} />;
}
