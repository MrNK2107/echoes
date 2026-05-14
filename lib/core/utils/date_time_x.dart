extension DateTimeX on DateTime {
  bool get isUtcNormalized => isUtc;

  DateTime get normalizedUtc => isUtc ? this : toUtc();
}
