import { useLocalSearchParams } from 'expo-router';

import { PlaceScreen } from '@/features/places/PlaceScreen';

export default function PlaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceScreen placeId={id} />;
}
