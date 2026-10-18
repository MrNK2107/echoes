import 'dart:async';

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
import 'package:permission_handler/permission_handler.dart';

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
            openSettings: true,
          ),
          MapStatus.failure => _LocationPrompt(
            message: state.errorMessage ?? 'Location lookup failed.',
          ),
          MapStatus.ready => _ReadyMap(state: state),
        };
      },
    );
  }
}

class _LocationPrompt extends StatelessWidget {
  const _LocationPrompt({this.message, this.openSettings = false});

  final String? message;
  final bool openSettings;

  @override
  Widget build(BuildContext context) {
    return FeaturePlaceholder(
      icon: Icons.travel_explore,
      title: 'Places remember first.',
      description:
          message ??
          'Use your current location to discover nearby memory places, aura colors, and quick access to details.',
      nextStep: 'Enable location to load nearby ECHOES.',
      action: FilledButton.icon(
        key: const ValueKey('requestLocationButton'),
        onPressed: openSettings
            ? openAppSettings
            : () => context.read<MapCubit>().requestLocation(),
        icon: Icon(openSettings ? Icons.settings_outlined : Icons.my_location),
        label: Text(openSettings ? 'Open settings' : 'Enable location'),
      ),
    );
  }
}

/// The ready state: shows a full-screen Google Map with a collapsible bottom
/// panel listing nearby places.
class _ReadyMap extends StatefulWidget {
  const _ReadyMap({required this.state});

  final MapState state;

  @override
  State<_ReadyMap> createState() => _ReadyMapState();
}

class _ReadyMapState extends State<_ReadyMap> {
  bool _showPlacesList = true;
  bool _mapFailed = false;
  Timer? _mapInitTimer;

  @override
  void initState() {
    super.initState();
    _mapInitTimer = Timer(const Duration(seconds: 10), () {
      if (mounted) {
        setState(() => _mapFailed = true);
      }
    });
  }

  @override
  void dispose() {
    _mapInitTimer?.cancel();
    super.dispose();
  }

  void _onMapCreated(GoogleMapController controller) {
    _mapInitTimer?.cancel();
    _mapInitTimer = null;
    if (mounted) {
      setState(() => _mapFailed = false);
    }
  }

  Set<Marker> _buildMarkers(BuildContext context, List<Place> places) {
    return places.map((place) {
      final hue = AuraMarkerHue.fromAura(place.aura);
      return Marker(
        markerId: MarkerId(place.id),
        position: LatLng(place.latitude, place.longitude),
        icon: BitmapDescriptor.defaultMarkerWithHue(hue),
        infoWindow: InfoWindow(
          title: place.name,
          snippet: '${place.memoryCount} memories - ${place.aura.dominantSentiment.name} aura',
          onTap: () => _showPlaceDetails(context, place),
        ),
        onTap: () => _showPlaceDetails(context, place),
      );
    }).toSet();
  }

  CameraPosition _initialCamera() {
    final location = widget.state.location!;
    return CameraPosition(
      target: LatLng(location.latitude, location.longitude),
      zoom: 15,
    );
  }

  @override
  Widget build(BuildContext context) {
    final places = widget.state.places;

    if (_mapFailed) {
      return _MapFallbackView(
        places: places,
        onRetry: () => setState(() => _mapFailed = false),
        onPlaceTap: (place) => _showPlaceDetails(context, place),
      );
    }

    return Stack(
      children: [
        // Full-screen Google Map
        GoogleMap(
          key: const ValueKey('nearbyMap'),
          initialCameraPosition: _initialCamera(),
          markers: _buildMarkers(context, places),
          myLocationEnabled: true,
          myLocationButtonEnabled: true,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
          onMapCreated: _onMapCreated,
          onTap: (_) {
            if (_showPlacesList) {
              setState(() => _showPlacesList = false);
            }
          },
        ),

        // Top header overlay
        Positioned(
          top: 12,
          left: 12,
          right: 12,
          child: _MapHeader(
            placeCount: places.length,
            onRefresh: () => context.read<MapCubit>().requestLocation(),
            onToggleList: () => setState(() => _showPlacesList = !_showPlacesList),
            isListVisible: _showPlacesList,
          ),
        ),

        // Collapsible nearby places panel at the bottom
        if (_showPlacesList && places.isNotEmpty)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _NearbyPlacesDrawer(
              places: places,
              onPlaceTap: (place) => _showPlaceDetails(context, place),
              onClose: () => setState(() => _showPlacesList = false),
            ),
          ),
      ],
    );
  }

  void _showPlaceDetails(BuildContext context, Place place) {
    String? currentUserId;
    try {
      currentUserId = context.read<AuthCubit>().state.session?.userId;
    } on Object {
      currentUserId = null;
    }

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (_) =>
          PlaceDetailSheet(place: place, currentUserId: currentUserId),
    );
  }
}

/// Semi-transparent header bar with place count, refresh button, and toggle.
class _MapHeader extends StatelessWidget {
  const _MapHeader({
    required this.placeCount,
    required this.onRefresh,
    required this.onToggleList,
    required this.isListVisible,
  });

  final int placeCount;
  final VoidCallback onRefresh;
  final VoidCallback onToggleList;
  final bool isListVisible;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.deepSpace.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoesColors.elevatedSurface),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.travel_explore, size: 20, color: EchoesColors.celestialBlue),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                placeCount == 1
                    ? '1 place nearby'
                    : '$placeCount places nearby',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: EchoesColors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            IconButton(
              icon: Icon(
                isListVisible ? Icons.expand_circle_down_outlined : Icons.list_outlined,
                size: 20,
              ),
              tooltip: isListVisible ? 'Collapse list' : 'Show list',
              onPressed: onToggleList,
            ),
            IconButton(
              icon: const Icon(Icons.my_location, size: 20),
              tooltip: 'Re-center and refresh',
              onPressed: onRefresh,
            ),
          ],
        ),
      ),
    );
  }
}

/// Draggable bottom drawer showing the list of nearby places.
class _NearbyPlacesDrawer extends StatelessWidget {
  const _NearbyPlacesDrawer({
    required this.places,
    required this.onPlaceTap,
    required this.onClose,
  });

  final List<Place> places;
  final ValueChanged<Place> onPlaceTap;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.deepSpace.withValues(alpha: 0.92),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(12),
          topRight: Radius.circular(12),
        ),
        border: Border(
          top: BorderSide(color: EchoesColors.elevatedSurface),
        ),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 240),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle + close row
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
              child: Row(
                children: [
                  const Spacer(),
                  Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: EchoesColors.textSecondary.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: 32,
                    height: 32,
                    child: IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      tooltip: 'Close places list',
                      onPressed: onClose,
                      padding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ),
            // Scrollable place list
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                itemCount: places.length,
                separatorBuilder: (_, _) => const SizedBox(height: 6),
                itemBuilder: (context, index) {
                  final place = places[index];
                  return _NearbyPlaceTile(
                    place: place,
                    rank: index + 1,
                    onTap: () => onPlaceTap(place),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Fallback shown when Google Maps fails or hangs during initialization.
class _MapFallbackView extends StatelessWidget {
  const _MapFallbackView({
    required this.places,
    required this.onRetry,
    required this.onPlaceTap,
  });

  final List<Place> places;
  final VoidCallback onRetry;
  final ValueChanged<Place> onPlaceTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: FeaturePlaceholder(
            icon: Icons.map_outlined,
            title: 'Map unavailable',
            description:
                'The map could not be loaded. You can still browse nearby places from the list below.',
            nextStep: 'Check your Google Maps API key and Google Play Services.',
            action: FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry map'),
            ),
          ),
        ),
        if (places.isNotEmpty)
          SizedBox(
            height: 240,
            child: _NearbyPlacesDrawer(
              places: places,
              onPlaceTap: onPlaceTap,
              onClose: () {},
            ),
          ),
      ],
    );
  }
}

class _NearbyPlaceTile extends StatelessWidget {
  const _NearbyPlaceTile({
    required this.place,
    required this.rank,
    required this.onTap,
  });

  final Place place;
  final int rank;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final auraColor = place.aura.color;

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: auraColor.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: auraColor.withValues(alpha: 0.7)),
                ),
                child: Text(
                  '$rank',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: auraColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      place.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: EchoesColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${place.memoryCount} memories - ${place.aura.dominantSentiment.name} aura',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: EchoesColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
