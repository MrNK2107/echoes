import { useLocalSearchParams } from 'expo-router';

import { InstitutionScreen } from '@/features/institutions/InstitutionScreen';

export default function InstitutionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <InstitutionScreen institutionId={id} />;
}
