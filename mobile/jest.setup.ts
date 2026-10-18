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
