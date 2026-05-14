import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';

class ProfilePlaceholderScreen extends StatelessWidget {
  const ProfilePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const FeaturePlaceholder(
      icon: Icons.account_circle_outlined,
      title: 'Custodianship starts here.',
      description:
          'Profiles will show created memories, managed places, legacy transfers, and privacy defaults.',
      nextStep:
          'Next: implement Firebase Auth and create user profile documents after signup.',
    );
  }
}
