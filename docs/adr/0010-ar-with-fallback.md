# ADR-0010: AR with ViroReact and an always-available 2D fallback

**Status:** Accepted
**Date:** 2026-10-19

## Context
The spec's signature experience is seeing place auras and memory orbs through
the camera. The Flutter app used ARCore/ARKit plugins with a GPS→scene mapper
(`lib/features/ar/domain/ar_scene_mapper.dart`). Native AR only works in a
development or store build, on supported devices. The India-first audience
includes many mid-range phones without ARCore.

## Decision
- **Domain.** Port `ArSceneMapper` to `mobile/src/domain/arScene.ts`, pinned by
  golden fixtures exported from Dart, as in Plan 1. The parameters are:
  - `maxPlaces 5`
  - `maxOrbsPerPlace 8`
  - `metersPerSceneUnit 12`
  - `maxSceneDistance 24`
  - aura radius `1.8 + 3.2·intensity`
  - aura opacity `0.18 + 0.32·intensity`
- **Heading.** The phone's compass heading comes from the device magnetometer
  (`expo-sensors` `Magnetometer`) or `Location.watchHeadingAsync`. The scene
  rotates by the true heading, so north is consistent.
- **AR renderer.** `@reactvision/react-viro`, the maintained ViroReact fork, with
  its Expo config plugin. It loads only through a guarded dynamic `require` in
  `src/device/arRenderer.ts`.
  - Auras are translucent spheres coloured by the aura colour.
  - Orbs are small glowing spheres around each aura.
  - Tapping an orb opens the memory.
- **Fallback.** `ArRadarView` is a 2D top-down radar drawn with
  `react-native-svg`. The device heading points up, places appear at their
  bearing and distance, and the same tap targets apply.
  - It is used when the native module is absent (Expo Go), when AR is
    unsupported, or when camera permission is denied.
  - It is also offered as a toggle (`Radar view` / `Camera view`).
- **Entry point.** A map button `AR` (accessibilityLabel `Explore in AR`) opens
  `/ar`.

## Consequences
- **Easier:** the feature works for every user. In Expo Go it is the radar view;
  in builds on capable phones it is full AR.
- **Harder:** the native AR path can only be verified on physical devices, so CI
  covers the mapper, the radar and the fallback selection with mocks.
- **Risk:** ViroReact compatibility with React Native 0.88 and the New
  Architecture. If its plugin fails to build, the fallback still ships, and AR
  is re-evaluated in Plan 5.
