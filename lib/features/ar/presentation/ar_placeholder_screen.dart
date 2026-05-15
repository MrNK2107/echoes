import 'package:echoes/app/theme.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/presentation/ar_cubit.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ArPlaceholderScreen extends StatelessWidget {
  const ArPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => ArCubit(
        availabilityService: context.read<ArAvailabilityService>(),
        permissionService: context.read<ArPermissionService>(),
      )..checkAvailability(),
      child: const _ArView(),
    );
  }
}

class _ArView extends StatelessWidget {
  const _ArView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ArCubit, ArState>(
      builder: (context, state) {
        return switch (state.status) {
          ArStatus.initial ||
          ArStatus.checking => const Center(child: CircularProgressIndicator()),
          ArStatus.permissionRequired => const _ArPermissionPrompt(),
          ArStatus.permissionDenied => _ArPermissionPrompt(
            isPermanentlyDenied: state.isPermissionPermanentlyDenied,
          ),
          ArStatus.ready => const _ArReadyPlaceholder(),
          ArStatus.unsupported => FeaturePlaceholder(
            icon: Icons.map_outlined,
            title: 'AR is not available here.',
            description:
                'This device or build does not currently support AR mode, so ECHOES will use the 2D map experience.',
            nextStep:
                'Next: wire ARCore/ARKit device checks and render aura domes on supported devices.',
            action: FilledButton.icon(
              onPressed: () =>
                  DefaultTabController.maybeOf(context)?.animateTo(0),
              icon: const Icon(Icons.map_outlined),
              label: const Text('Use map view'),
            ),
          ),
          ArStatus.failure => FeaturePlaceholder(
            icon: Icons.error_outline,
            title: 'AR check failed.',
            description: state.errorMessage ?? 'Unable to check AR support.',
            nextStep: 'Next: retry availability detection or use the map view.',
            action: OutlinedButton.icon(
              onPressed: () => context.read<ArCubit>().checkAvailability(),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ),
        };
      },
    );
  }
}

class _ArPermissionPrompt extends StatelessWidget {
  const _ArPermissionPrompt({this.isPermanentlyDenied = false});

  final bool isPermanentlyDenied;

  @override
  Widget build(BuildContext context) {
    return FeaturePlaceholder(
      icon: Icons.photo_camera_outlined,
      title: isPermanentlyDenied
          ? 'Camera access is blocked.'
          : 'Camera access unlocks AR.',
      description: isPermanentlyDenied
          ? 'Enable camera access in system settings to use aura view.'
          : 'ECHOES uses the camera to place aura zones and memory orbs around nearby places.',
      nextStep: isPermanentlyDenied
          ? 'Next: open system settings, then return to aura view.'
          : 'Next: grant camera access, then start the AR scene.',
      action: FilledButton.icon(
        key: const ValueKey('requestArPermissionButton'),
        onPressed: isPermanentlyDenied
            ? null
            : () => context.read<ArCubit>().requestPermission(),
        icon: const Icon(Icons.photo_camera_outlined),
        label: const Text('Allow camera'),
      ),
    );
  }
}

class _ArReadyPlaceholder extends StatelessWidget {
  const _ArReadyPlaceholder();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Aura View',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'AR support is available. The next slice will start the camera session and render nearby aura zones.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
