import type { ExpoConfig } from 'expo/config';

// Single source of truth for Expo config (app.json was removed).
const config: ExpoConfig = {
  name: 'ECHOES',
  slug: 'echoes',
  scheme: 'echoes',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    [
      'expo-location',
      { locationWhenInUsePermission: 'ECHOES uses your location to find and pin memories near you.' },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'ECHOES lets you attach photos to your memories.',
        cameraPermission: 'ECHOES lets you attach photos to your memories.',
      },
    ],
  ],
};

export default config;
