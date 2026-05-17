import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/map/presentation/aura_marker_hue.dart';
import 'package:echoes/features/map/presentation/map_cubit.dart';
import 'package:echoes/features/map/presentation/map_state.dart';
import 'package:echoes/features/map/presentation/map_status.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/places/presentation/place_detail_sheet.dart';
import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class MapPlaceholderScreen extends StatelessWidget {
  const MapPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => MapCubit(
        locationService: context.read<LocationService>(),
        placeRepository: context.read<PlaceRepository>(),
      ),
      child: const _MapView(),
    );
  }
}

class _MapView extends StatelessWidget {
  const _MapView();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<MapCubit, MapState>(
      builder: (context, state) {
        return switch (state.status) {
          MapStatus.initial => const _LocationPrompt(),
          MapStatus.loadingLocation => const Center(
            child: CircularProgressIndicator(),
          ),
          MapStatus.permissionDenied => const _LocationPrompt(
            message: 'Location access is needed to discover nearby memories.',
          ),
          MapStatus.permissionDeniedForever => const _LocationPrompt(
            message:
                'Location access is blocked. Enable it in system settings to use the map.',
          ),
          MapStatus.failure => _LocationPrompt(
            message: state.errorMessage ?? 'Location lookup failed.',
          ),
          MapStatus.ready => _ReadyMapPlaceholder(state: state),
        };
      },
    );
  }
}

class _LocationPrompt extends StatelessWidget {
  const _LocationPrompt({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return FeaturePlaceholder(
      icon: Icons.travel_explore,
      title: 'Places remember first.',
      description:
          message ??
          'The map will use your current location to show nearby places with memories, aura colors, and quick access to details.',
      nextStep:
          'Next: enable location, then connect Google Maps and nearby place queries.',
      action: FilledButton.icon(
        key: const ValueKey('requestLocationButton'),
        onPressed: () => context.read<MapCubit>().requestLocation(),
        icon: const Icon(Icons.my_location),
        label: const Text('Enable location'),
      ),
    );
  }
}

class _ReadyMapPlaceholder extends StatelessWidget {
  const _ReadyMapPlaceholder({required this.state});

  final MapState state;

  @override
  Widget build(BuildContext context) {
    final location = state.location!;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Nearby Echoes',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Location ready: ${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: GoogleMap(
                  initialCameraPosition: CameraPosition(
                    target: LatLng(location.latitude, location.longitude),
                    zoom: 15,
                  ),
                  markers: _markersFor(context, state.places),
                  myLocationEnabled: true,
                  myLocationButtonEnabled: false,
                  zoomControlsEnabled: false,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              state.places.isEmpty
                  ? 'No memory places nearby yet.'
                  : '${state.places.length} memory places nearby',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => context.read<MapCubit>().requestLocation(),
              icon: const Icon(Icons.my_location),
              label: const Text('Refresh location'),
            ),
          ],
        ),
      ),
    );
  }

  Set<Marker> _markersFor(BuildContext context, List<Place> places) {
    return places.map((place) {
      return Marker(
        markerId: MarkerId(place.id),
        position: LatLng(place.latitude, place.longitude),
        infoWindow: InfoWindow(
          title: place.name,
          snippet: '${place.memoryCount} memories',
          onTap: () => _showPlaceDetails(context, place),
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(
          AuraMarkerHue.fromAura(place.aura),
        ),
        onTap: () => _showPlaceDetails(context, place),
      );
    }).toSet();
  }

  void _showPlaceDetails(BuildContext context, Place place) {
    final currentUserId = context.read<AuthCubit>().state.session?.userId;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) =>
          PlaceDetailSheet(place: place, currentUserId: currentUserId),
    );
  }
}
