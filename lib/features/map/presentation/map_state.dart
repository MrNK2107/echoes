import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/map/presentation/map_status.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:equatable/equatable.dart';

class MapState extends Equatable {
  const MapState({
    required this.status,
    this.places = const [],
    this.location,
    this.errorMessage,
  });

  const MapState.initial() : this(status: MapStatus.initial);

  final MapStatus status;
  final List<Place> places;
  final DeviceLocation? location;
  final String? errorMessage;

  MapState copyWith({
    MapStatus? status,
    List<Place>? places,
    DeviceLocation? location,
    String? errorMessage,
  }) {
    return MapState(
      status: status ?? this.status,
      places: places ?? this.places,
      location: location ?? this.location,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, places, location, errorMessage];
}
