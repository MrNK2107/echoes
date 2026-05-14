import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';

class ArPlaceholderScreen extends StatelessWidget {
  const ArPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholder(
      icon: Icons.blur_circular,
      title: 'Aura zones will live here.',
      description:
          'AR mode will render semi-transparent emotional domes and memory orbs around nearby places.',
      nextStep:
          'Next: build AR availability detection after the map and memory MVP are stable.',
    );
  }
}
