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
    required this.auraRadius,
    required this.auraOpacity,
    required this.visibleOrbCount,
  });

  final Place place;
  final double eastMeters;
  final double northMeters;
  final double distanceMeters;
  final double bearingDegrees;
  final double sceneX;
  final double sceneZ;
  final double auraRadius;
  final double auraOpacity;
  final int visibleOrbCount;

  String get distanceLabel {
    if (distanceMeters < 1000) {
      return '${distanceMeters.round()} m';
    }
    return '${(distanceMeters / 1000).toStringAsFixed(1)} km';
  }

  String get directionLabel {
    const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    final index = ((bearingDegrees + 22.5) ~/ 45) % labels.length;
    return labels[index];
  }
}
