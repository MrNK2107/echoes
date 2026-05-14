import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';

class AddMemoryPlaceholderScreen extends StatelessWidget {
  const AddMemoryPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholder(
      icon: Icons.add_photo_alternate_outlined,
      title: 'Capture a memory.',
      description:
          'This flow will collect text, a photo, GPS location, privacy, and on-device sentiment before saving.',
      nextStep:
          'Next: implement photo selection, text validation, GPS capture, and public/private privacy.',
    );
  }
}
