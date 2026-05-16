import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/ar/domain/ar_scene_place.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:equatable/equatable.dart';

class ArState extends Equatable {
  const ArState({
    required this.status,
    this.errorMessage,
    this.isPermissionPermanentlyDenied = false,
    this.isSessionRunning = false,
    this.location,
    this.nearbyPlaces = const [],
    this.scenePlaces = const [],
  });

  const ArState.initial() : this(status: ArStatus.initial);

  final ArStatus status;
  final String? errorMessage;
  final bool isPermissionPermanentlyDenied;
  final bool isSessionRunning;
  final DeviceLocation? location;
  final List<Place> nearbyPlaces;
  final List<ArScenePlace> scenePlaces;

  ArState copyWith({
    ArStatus? status,
    String? errorMessage,
    bool? isPermissionPermanentlyDenied,
    bool? isSessionRunning,
    DeviceLocation? location,
    List<Place>? nearbyPlaces,
    List<ArScenePlace>? scenePlaces,
  }) {
    return ArState(
      status: status ?? this.status,
      errorMessage: errorMessage,
      isPermissionPermanentlyDenied:
          isPermissionPermanentlyDenied ?? this.isPermissionPermanentlyDenied,
      isSessionRunning: isSessionRunning ?? this.isSessionRunning,
      location: location ?? this.location,
      nearbyPlaces: nearbyPlaces ?? this.nearbyPlaces,
      scenePlaces: scenePlaces ?? this.scenePlaces,
    );
  }

  @override
  List<Object?> get props => [
    status,
    errorMessage,
    isPermissionPermanentlyDenied,
    isSessionRunning,
    location,
    nearbyPlaces,
    scenePlaces,
  ];
}
