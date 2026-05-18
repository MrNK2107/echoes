import 'package:flutter/foundation.dart';

abstract interface class CrashReportingService {
  Future<void> recordFlutterError(FlutterErrorDetails details);

  Future<void> recordError(
    Object error,
    StackTrace stackTrace, {
    bool fatal = false,
  });
}
