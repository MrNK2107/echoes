// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// src/domain/profanity.ts imports the shared word list from the repo's fixtures/ folder (single
// source of truth with functions/), which lives outside this project, so Metro must watch it.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../fixtures')];

module.exports = config;
