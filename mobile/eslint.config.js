// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const upward = (layers) => ({
  patterns: [
    {
      group: layers.flatMap((l) => [`@/${l}`, `@/${l}/**`]),
      message: 'Layering: lower layers must not import upper layers (domain < data/device < services < features).',
    },
  ],
});

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', upward(['data', 'device', 'services', 'features'])] },
  },
  {
    files: ['src/data/**/*.{ts,tsx}', 'src/device/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', upward(['features'])] },
  },
]);
