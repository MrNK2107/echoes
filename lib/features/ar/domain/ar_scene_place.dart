import 'package:echoes/features/places/domain/place.dart';

class ArScenePlace {
  const ArScenePlace({
    required this.place,
    required this.eastMeters,
    required this.northMeters,
    required this.distanceMeters,
    required this.bearingDegrees,
    required this.sceneX,
    required this.sceneZ,
  });

  final Place place;
  final double eastMeters;
  final double northMeters;
  final double distanceMeters;
  final double bearingDegrees;
  final double sceneX;
  final double sceneZ;

  String get distanceLabel {
    if (distanceMeters < 1000) {
      return '${distanceMeters.round()} m';
    }
    return '${(distanceMeters / 1000).toStringAsFixed(1)} km';
  }
}
