import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/map/presentation/map_state.dart';
import 'package:echoes/features/map/presentation/map_status.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class MapCubit extends Cubit<MapState> {
  MapCubit({required LocationService locationService})
    : _locationService = locationService,
      super(const MapState.initial());

  final LocationService _locationService;

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
      emit(state.copyWith(status: MapStatus.ready, location: location));
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
