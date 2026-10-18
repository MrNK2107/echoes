import { useLocalSearchParams } from 'expo-router';

import { MemoryDetailScreen } from '@/features/memories/MemoryDetailScreen';

export default function MemoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MemoryDetailScreen memoryId={id} />;
}
