import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { readConfig } from '@/services/config';
import { createServices } from '@/services/createServices';
import { ServicesProvider } from '@/services/ServicesProvider';

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` accesses, so list them explicitly.
const config = readConfig({
  EXPO_PUBLIC_BACKEND: process.env.EXPO_PUBLIC_BACKEND,
  EXPO_PUBLIC_EMULATOR_HOST: process.env.EXPO_PUBLIC_EMULATOR_HOST,
  EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_GUIDELINES_URL: process.env.EXPO_PUBLIC_GUIDELINES_URL,
  EXPO_PUBLIC_SUPPORT_EMAIL: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
});
const services = createServices(config);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ServicesProvider services={services}>
        <Stack screenOptions={{ headerShown: false }} />
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
