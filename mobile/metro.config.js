const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Extends Expo's default Metro config (it calls getDefaultConfig internally) and adds Debug IDs
// to bundles and source maps so Sentry can symbolicate stack traces (ADR-0011).
module.exports = getSentryExpoConfig(__dirname);
