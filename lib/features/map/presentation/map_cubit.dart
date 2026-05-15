import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/map/presentation/map_state.dart';
import 'package:echoes/features/map/presentation/map_status.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class MapCubit extends Cubit<MapState> {
  MapCubit({
    required LocationService locationService,
    required PlaceRepository placeRepository,
  }) : _locationService = locationService,
       _placeRepository = placeRepository,
       super(const MapState.initial());

  static const nearbyRadiusMeters = 1500.0;

  final LocationService _locationService;
  final PlaceRepository _placeRepository;

  Future<void> requestLocation() async {
    emit(state.copyWith(status: MapStatus.loadingLocation));

    try {
      var permission = await _locationService.checkPermission();
      if (permission == LocationPermissionState.denied ||
          permission == LocationPermissionState.unknown) {
        permission = await _locationService.requestPermission();
      }

      if (permission == LocationPermissionState.deniedForever) {
        emit(state.copyWith(status: MapStatus.permissionDeniedForever));
        return;
      }
      if (!permission.isGranted) {
        emit(state.copyWith(status: MapStatus.permissionDenied));
        return;
      }

      final location = await _locationService.getCurrentLocation();
      final places = await _placeRepository
          .watchNearbyPlaces(
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: nearbyRadiusMeters,
          )
          .first;
      emit(
        state.copyWith(
          status: MapStatus.ready,
          location: location,
          places: places,
        ),
      );
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: MapStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }
}
