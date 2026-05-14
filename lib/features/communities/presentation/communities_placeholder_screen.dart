import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';

class CommunitiesPlaceholderScreen extends StatelessWidget {
  const CommunitiesPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholder(
      icon: Icons.diversity_3_outlined,
      title: 'Communities come after places.',
      description:
          'Thematic, geographic, time-based, and institution communities will organize shared memory archives.',
      nextStep:
          'Next: add community models after the core place and memory flows are working.',
    );
  }
}
