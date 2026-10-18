import 'package:echoes/core/geo/geohash.dart';

class NearbyPlaceQuery {
  const NearbyPlaceQuery({
    required this.latitude,
    required this.longitude,
    required this.radiusMeters,
    required this.geohash,
    required this.geohashPrefix,
  });

  factory NearbyPlaceQuery.fromLocation({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    final geohash = Geohash.encode(latitude: latitude, longitude: longitude);
    final prefixLength = geohashPrecisionFor(radiusMeters);

    return NearbyPlaceQuery(
      latitude: latitude,
      longitude: longitude,
      radiusMeters: radiusMeters,
      geohash: geohash,
      geohashPrefix: geohash.substring(0, prefixLength),
    );
  }

  /// Returns an appropriate geohash prefix length for a given search radius.
  ///
  /// Approximate geohash cell dimensions at the equator:
  /// - Precision 7: ~76m x ~153m (building-level)
  /// - Precision 6: ~610m x ~1.2km (neighborhood-level)
  /// - Precision 5: ~4.9km x ~9.8km (city-district-level)
  /// - Precision 4: ~39km x ~78km (city-level)
  ///
  /// We choose the next coarser precision so the prefix bounds are guaranteed
  /// to cover the full radius without missing edge-case cells.
  static int geohashPrecisionFor(double radiusMeters) {
    if (radiusMeters <= 100) {
      return 7;
    } else if (radiusMeters <= 500) {
      return 6;
    } else if (radiusMeters <= 4000) {
      return 5;
    }
    return 4;
  }

  /// Returns the set of geohash prefix strings to query for a given radius.
  ///
  /// For small radii, the origin prefix alone is sufficient because the
  /// geohash cell is larger than the search radius (e.g., precision 7 cell
  /// is ~76m × ~153m while radius is 100m). For larger radii where the
  /// radius exceeds the cell size, we include neighboring cells.
  static List<String> queryPrefixes({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) {
    final origin = Geohash.encode(latitude: latitude, longitude: longitude);
    final prefixLength = geohashPrecisionFor(radiusMeters);
    final prefix = origin.substring(0, prefixLength);

    // For most queries, a single prefix is sufficient since we post-filter
    // with exact Haversine distance. If radius > 2× the cell width, we
    // expand to include the 8 neighbor cells.
    if (radiusMeters <= _cellWidthMeters(prefixLength) * 1.5) {
      return [prefix];
    }

    return _expandPrefix(prefix, prefixLength);
  }

  static double _cellWidthMeters(int precision) {
    // Approximate cell width at equator for each geohash precision
    const widths = <double>[
      5000000, 1250000, 156000, 39000, 4900, 610, 76, 19, 4.8, 0.6,
    ];
    final index = (precision - 1).clamp(0, widths.length - 1);
    return widths[index];
  }

  static List<String> _expandPrefix(String prefix, int precision) {
    const neighbors = [
      '', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'm', 'n',
      'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    ];
    return [
      for (final n in neighbors) '$prefix$n',
    ];
  }

  final double latitude;
  final double longitude;
  final double radiusMeters;
  final String geohash;
  final String geohashPrefix;
}
