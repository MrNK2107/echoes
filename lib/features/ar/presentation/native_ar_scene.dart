import 'dart:async';

import 'package:arcore_flutter_plus/arcore_flutter_plus.dart';
import 'package:arkit_plugin/arkit_plugin.dart';
import 'package:echoes/features/ar/domain/ar_scene_place.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:vector_math/vector_math_64.dart' as vector;

class NativeArScene extends StatelessWidget {
  const NativeArScene({
    required this.scenePlaces,
    required this.onPlaceTap,
    super.key,
  });

  final List<ArScenePlace> scenePlaces;
  final ValueChanged<String> onPlaceTap;

  static bool get isSupportedPlatform =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  @override
  Widget build(BuildContext context) {
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => _AndroidArScene(
        scenePlaces: scenePlaces,
        onPlaceTap: onPlaceTap,
      ),
      TargetPlatform.iOS => _IosArScene(
        scenePlaces: scenePlaces,
        onPlaceTap: onPlaceTap,
      ),
      _ => const SizedBox.shrink(),
    };
  }
}

class _AndroidArScene extends StatefulWidget {
  const _AndroidArScene({required this.scenePlaces, required this.onPlaceTap});

  final List<ArScenePlace> scenePlaces;
  final ValueChanged<String> onPlaceTap;

  @override
  State<_AndroidArScene> createState() => _AndroidArSceneState();
}

class _AndroidArSceneState extends State<_AndroidArScene> {
  ArCoreController? _controller;
  final _nodeNames = <String>[];

  @override
  void didUpdateWidget(covariant _AndroidArScene oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scenePlaces != widget.scenePlaces) {
      unawaited(_render());
    }
  }

  Future<void> _created(ArCoreController controller) async {
    _controller = controller;
    controller.onNodeTap = (name) {
      if (name.startsWith('place-')) {
        widget.onPlaceTap(name.substring('place-'.length));
      }
    };
    await _render();
  }

  Future<void> _render() async {
    final controller = _controller;
    if (controller == null) return;
    for (final name in _nodeNames) {
      await controller.removeNode(nodeName: name);
    }
    _nodeNames.clear();
    for (final scenePlace in widget.scenePlaces) {
      final name = 'place-${scenePlace.place.id}';
      final material = ArCoreMaterial(
        color: scenePlace.place.aura.color.withValues(
          alpha: scenePlace.auraOpacity.clamp(0.25, 0.7),
        ),
        metallic: 0.15,
      );
      final node = ArCoreNode(
        name: name,
        shape: ArCoreSphere(
          materials: [material],
          radius: (scenePlace.auraRadius * 0.055).clamp(0.12, 0.32),
        ),
        position: vector.Vector3(
          (scenePlace.sceneX * 0.12).clamp(-2.5, 2.5),
          0,
          (scenePlace.sceneZ.abs() * -0.12 - 1.0).clamp(-4.0, -1.0),
        ),
      );
      await controller.addArCoreNode(node);
      _nodeNames.add(name);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ArCoreView(
    key: const ValueKey('nativeArCoreView'),
    enableTapRecognizer: true,
    enablePlaneRenderer: false,
    onArCoreViewCreated: _created,
  );
}

class _IosArScene extends StatefulWidget {
  const _IosArScene({required this.scenePlaces, required this.onPlaceTap});

  final List<ArScenePlace> scenePlaces;
  final ValueChanged<String> onPlaceTap;

  @override
  State<_IosArScene> createState() => _IosArSceneState();
}

class _IosArSceneState extends State<_IosArScene> {
  ARKitController? _controller;
  final _nodeNames = <String>[];

  @override
  void didUpdateWidget(covariant _IosArScene oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scenePlaces != widget.scenePlaces) {
      unawaited(_render());
    }
  }

  Future<void> _created(ARKitController controller) async {
    _controller = controller;
    controller.onNodeTap = (names) {
      for (final name in names) {
        if (name.startsWith('place-')) {
          widget.onPlaceTap(name.substring('place-'.length));
          return;
        }
      }
    };
    await _render();
  }

  Future<void> _render() async {
    final controller = _controller;
    if (controller == null) return;
    for (final name in _nodeNames) {
      await controller.remove(name);
    }
    _nodeNames.clear();
    for (final scenePlace in widget.scenePlaces) {
      final name = 'place-${scenePlace.place.id}';
      final material = ARKitMaterial(
        diffuse: ARKitMaterialProperty.color(
          scenePlace.place.aura.color.withValues(
            alpha: scenePlace.auraOpacity.clamp(0.25, 0.7),
          ),
        ),
        transparency: scenePlace.auraOpacity.clamp(0.25, 0.7),
      );
      final node = ARKitNode(
        name: name,
        geometry: ARKitSphere(
          materials: [material],
          radius: (scenePlace.auraRadius * 0.055).clamp(0.12, 0.32),
        ),
        position: vector.Vector3(
          (scenePlace.sceneX * 0.12).clamp(-2.5, 2.5),
          0,
          (scenePlace.sceneZ.abs() * -0.12 - 1.0).clamp(-4.0, -1.0),
        ),
      );
      await controller.add(node);
      _nodeNames.add(name);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ARKitSceneView(
    key: const ValueKey('nativeArKitView'),
    enableTapRecognizer: true,
    onARKitViewCreated: _created,
  );
}
