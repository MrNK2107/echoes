# ADR-0010: Camera AR with an always-available 2D fallback (Viro renderer superseded, see Amendment)

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

## Implementation notes (Plan 4, Task 6)
- `ArScreen` renders the renderer's `Scene` only when it is non-null, `status()` is
  `available` and the camera is granted. The camera permission is requested only
  when AR is otherwise usable. Until the native library is bundled, `Scene` is
  null and every device shows the radar with the unsupported copy.
- `useArScene` keeps at most 5 memory subscriptions (one per place, nearest 5
  within 1 km), re-created only when the set of place ids changes. Heading never
  triggers data loading. Orbs stay hidden until the block list is ready.

## Camera wording (Plan 5, R5-7)
Camera AR is not in v1, so the camera permission string (iOS `NSCameraUsageDescription`, the image picker and the guarded viro plugin in `mobile/app.config.ts`) covers photos only: "ECHOES uses the camera to attach photos to your memories." The AR wording ("... and to show memories around you in AR") returns when camera AR ships. Re-check the store privacy labels at that time.

## Amendment: location-based camera AR without Viro (2026-10-19)

**Status:** Accepted. Supersedes the Viro renderer above. The domain mapper, the radar and the fallback rules stay.

### Context
`@reactvision/react-viro` 3.0.3 (the latest release, 2026-10-07) declares the peers `expo >=57 <58` and
`react-native >=0.86 <0.87`. It cannot install on Expo SDK 58 / RN 0.88, so the camera mode never
switched on. ECHOES anchors content to GPS places tens to hundreds of metres away. World-tracking AR
(ARCore/ARKit plane detection) adds little at that range, and GPS error (5 to 20 m) dominates
anyway.

### Decision
- **Renderer.** `src/device/ar/CameraArScene.tsx`. The live `expo-camera` `CameraView` preview, with
  an overlay of place auras, memory orbs, names and distances.
- **Pose.** `expo-sensors` `DeviceMotion.rotation` at about 30 Hz. This is the fused rotation-vector
  sensor on Android and CoreMotion attitude (`xMagneticNorthZVertical`) on iOS.
  - `basisFromDeviceMotion` converts both to the same East-North-Up rotation. iOS yaw is offset
    by 90° because its X axis is north.
  - Working from the full rotation matrix, not an Euler heading, keeps the camera direction exact
    when the phone is upright. `Location.watchHeadingAsync` on Android is unreliable in that pose
    (gimbal lock).
- **Projection.** `src/domain/arProjection.ts` (pure, unit tested):
  - A pinhole model with a 62° vertical field of view across the preview height.
  - Magnetic declination comes from `Location.getHeadingAsync()` (true minus magnetic).
  - Markers float 1.5 m above eye level (`anchorElevation`).
  - Aura size is perspective-scaled and clamped to 44–140 pt.
  - Overlapping markers are pushed apart vertically, nearest first.
  - Places out of view become edge chips ("‹ UB City · 320 m"), which can also be tapped.
- **Availability.** `status()` is `available` on iOS or Android when `DeviceMotion.isAvailableAsync()`
  is true. The camera permission is asked only then.
- **Fallback.** No attitude sample within 3 s, or a camera mount error, calls `onTrackingError`, and
  the screen falls back to the radar. Everything else in this ADR's fallback rules is unchanged.
- **Config.**
  - The `expo-camera` plugin sets `recordAudioAndroid: false` and `barcodeScannerEnabled: false`, and
    reuses the voice-note microphone string.
  - The `expo-sensors` plugin sets `motionPermission: false`. Attitude needs no permission, and
    this keeps `NSMotionUsageDescription` out.
  - The camera string regains the AR wording: "ECHOES uses the camera to attach photos to your
    memories and to show memories around you in AR."

### Consequences
- **Easier:** camera AR works in Expo Go and in every build on any phone with a camera and a
  compass. It does not need ARCore.
- **Harder:**
  - Markers are fixed to compass directions, not to surfaces. Magnetic interference (cars, steel
    frames) shifts them until the compass recovers.
  - The field of view is a constant. Real lenses range from about 55° to 70°, so markers away from
    the centre drift slightly.
- **Verification:** CI covers the projection math, the scene (with injected camera and motion) and
  the renderer selection. Overlay accuracy and frame rate must still be checked on physical Android
  and iOS devices before release.
