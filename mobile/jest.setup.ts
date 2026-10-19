// jest-expo auto-mocks expo-crypto's native module, which makes randomUUID() return undefined.
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID() as string,
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  const MapView = ({ children }: { children?: unknown }) => React.createElement(View, { testID: 'map' }, children);
  const Marker = ({ testID, onPress, pinColor, title }: Record<string, unknown>) =>
    React.createElement(Pressable, { testID, onPress, pinColor, title });
  return { __esModule: true, default: MapView, Marker };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-audio evaluates native classes at import time; only createServices' import graph needs this.
jest.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: jest.fn(), AudioRecorder: jest.fn() },
  RecordingPresets: { HIGH_QUALITY: {} },
  createAudioPlayer: jest.fn(),
  setAudioModeAsync: jest.fn(),
}));

// No SafeAreaProvider in unit tests; the library's mock supplies zero insets (tests override via jest.mock).
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
