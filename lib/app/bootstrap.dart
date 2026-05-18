import 'dart:async';

import 'package:echoes/app/error_fallback.dart';
import 'package:echoes/core/crash/crash_reporting_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

typedef AppBuilder = Widget Function();

void bootstrap(AppBuilder builder, {CrashReportingService? crashReporting}) {
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    unawaited(crashReporting?.recordFlutterError(details));
    Zone.current.handleUncaughtError(
      details.exception,
      details.stack ?? StackTrace.current,
    );
  };

  ErrorWidget.builder = (details) {
    return ErrorFallback(details: details);
  };

  runZonedGuarded(() => runApp(builder()), (error, stackTrace) {
    unawaited(crashReporting?.recordError(error, stackTrace, fatal: true));
    if (kDebugMode) {
      FlutterError.dumpErrorToConsole(
        FlutterErrorDetails(exception: error, stack: stackTrace),
      );
    }
  });
}
