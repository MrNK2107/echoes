import { Alert } from 'react-native';

import { containsProfanity } from '@/domain/profanity';
import { PROFANITY_WARNING } from '@/ui/copy';

/**
 * ADR-0008 soft check before saving: when the text may be offensive, asks `Edit` / `Save anyway`
 * and returns true (the caller stops; `Save anyway` runs `saveAnyway`). Returns false for clean
 * text, so the caller saves straight away.
 */
export function askBeforeSavingProfanity(text: string, saveAnyway: () => void): boolean {
  if (!containsProfanity(text)) return false;
  Alert.alert(PROFANITY_WARNING, undefined, [
    { text: 'Edit', style: 'cancel' },
    { text: 'Save anyway', onPress: saveAnyway },
  ]);
  return true;
}
