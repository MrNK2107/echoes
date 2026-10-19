import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True inside Expo Go, where custom native modules (Viro, push tokens) are not available. */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}
