import { useLocalSearchParams } from 'expo-router';

import { EditMemoryScreen } from '@/features/memories/EditMemoryScreen';

export default function EditMemoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditMemoryScreen memoryId={id} />;
}
