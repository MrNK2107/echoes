class Geohash {
  static const _base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

  static String encode({
    required double latitude,
    required double longitude,
    int precision = 9,
  }) {
    var isEven = true;
    var bit = 0;
    var charIndex = 0;
    final hash = StringBuffer();
    final latitudeRange = [-90.0, 90.0];
    final longitudeRange = [-180.0, 180.0];

    while (hash.length < precision) {
      if (isEven) {
        final midpoint = (longitudeRange[0] + longitudeRange[1]) / 2;
        if (longitude >= midpoint) {
          charIndex = (charIndex << 1) + 1;
          longitudeRange[0] = midpoint;
        } else {
          charIndex <<= 1;
          longitudeRange[1] = midpoint;
        }
      } else {
        final midpoint = (latitudeRange[0] + latitudeRange[1]) / 2;
        if (latitude >= midpoint) {
          charIndex = (charIndex << 1) + 1;
          latitudeRange[0] = midpoint;
        } else {
          charIndex <<= 1;
          latitudeRange[1] = midpoint;
        }
      }

      isEven = !isEven;
      if (++bit == 5) {
        hash.write(_base32[charIndex]);
        bit = 0;
        charIndex = 0;
      }
    }

    return hash.toString();
  }
}
