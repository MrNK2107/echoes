import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import type { AppConfig } from './config';

/**
 * `getReactNativePersistence` is exported by the react-native build of `@firebase/auth`
 * (package.json `exports["."]["react-native"]`), which Metro picks up for `firebase/auth`.
 * Its types live in `dist/index.rn.d.ts`, so tsconfig maps `firebase/auth` to that file.
 */
export function initFirebase(config: AppConfig): { db: Firestore; auth: Auth; storage: FirebaseStorage } {
  if (!config.firebase) throw new Error('Firebase config is required for this backend');
  const app = initializeApp(config.firebase);
  const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  const db = getFirestore(app);
  const storage = getStorage(app);
  if (config.backend === 'emulator') {
    connectAuthEmulator(auth, `http://${config.emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, config.emulatorHost, 8080);
    connectStorageEmulator(storage, config.emulatorHost, 9199);
  }
  return { db, auth, storage };
}
