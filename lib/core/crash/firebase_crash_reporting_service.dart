import 'package:echoes/core/crash/crash_reporting_service.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';

class FirebaseCrashReportingService implements CrashReportingService {
  FirebaseCrashReportingService({FirebaseCrashlytics? crashlytics})
    : _crashlytics = crashlytics ?? FirebaseCrashlytics.instance;

  final FirebaseCrashlytics _crashlytics;

  @override
  Future<void> recordError(
    Object error,
    StackTrace stackTrace, {
    bool fatal = false,
  }) {
    return _crashlytics.recordError(error, stackTrace, fatal: fatal);
  }

  @override
  Future<void> recordFlutterError(FlutterErrorDetails details) {
    return _crashlytics.recordFlutterError(details, fatal: true);
  }
}
