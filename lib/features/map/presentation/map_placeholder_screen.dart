import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';

class MapPlaceholderScreen extends StatelessWidget {
  const MapPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholder(
      icon: Icons.travel_explore,
      title: 'Places remember first.',
      description:
          'The map will show nearby places with memory counts, aura colors, and quick access to place details.',
      nextStep:
          'Next: add location permissions, Google Maps, and nearby place queries.',
    );
  }
}
