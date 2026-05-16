import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:echoes/features/ar/presentation/ar_cubit.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
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
        sessionService: context.read<ArSessionService>(),
        locationService: context.read<LocationService>(),
        placeRepository: context.read<PlaceRepository>(),
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
          ArStatus.starting => const _ArSessionPlaceholder(isStarting: true),
          ArStatus.running => _ArSessionPlaceholder(state: state),
          ArStatus.stopping => const _ArSessionPlaceholder(isStopping: true),
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
              'AR support is available. Start the camera session to prepare the aura scene.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              key: const ValueKey('startArSessionButton'),
              onPressed: () => context.read<ArCubit>().startSession(),
              icon: const Icon(Icons.view_in_ar_outlined),
              label: const Text('Start aura view'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArSessionPlaceholder extends StatelessWidget {
  const _ArSessionPlaceholder({
    this.state,
    this.isStarting = false,
    this.isStopping = false,
  });

  final ArState? state;
  final bool isStarting;
  final bool isStopping;

  @override
  Widget build(BuildContext context) {
    final isBusy = isStarting || isStopping;
    final scenePlaces = state?.scenePlaces ?? const [];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: EchoesColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: EchoesColors.elevatedSurface),
                ),
                child: Center(
                  child: isBusy
                      ? const CircularProgressIndicator()
                      : Icon(
                          Icons.view_in_ar_outlined,
                          color: EchoesColors.sunsetGold,
                          size: 72,
                        ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isStarting
                  ? 'Starting aura view'
                  : isStopping
                  ? 'Stopping aura view'
                  : _runningLabel,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (scenePlaces.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                scenePlaces
                    .map(
                      (scenePlace) =>
                          '${scenePlace.place.name} · ${scenePlace.distanceLabel}',
                    )
                    .join('\n'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: EchoesColors.textSecondary,
                  height: 1.35,
                ),
              ),
            ],
            const SizedBox(height: 16),
            OutlinedButton.icon(
              key: const ValueKey('stopArSessionButton'),
              onPressed: isBusy
                  ? null
                  : () => context.read<ArCubit>().stopSession(),
              icon: const Icon(Icons.close_fullscreen),
              label: const Text('Stop aura view'),
            ),
          ],
        ),
      ),
    );
  }

  String get _runningLabel {
    final places = state?.nearbyPlaces.length ?? 0;
    if (places == 0) {
      return 'Aura view is running';
    }
    return places == 1
        ? 'Aura view is tracking 1 nearby place'
        : 'Aura view is tracking $places nearby places';
  }
}
