import 'package:echoes/core/crash/crash_reporting_service.dart';
import 'package:flutter/foundation.dart';

class LocalCrashReportingService implements CrashReportingService {
  final List<Object> recordedErrors = [];
  final List<FlutterErrorDetails> recordedFlutterErrors = [];

  @override
  Future<void> recordError(
    Object error,
    StackTrace stackTrace, {
    bool fatal = false,
  }) async {
    recordedErrors.add(error);
  }

  @override
  Future<void> recordFlutterError(FlutterErrorDetails details) async {
    recordedFlutterErrors.add(details);
  }
}
