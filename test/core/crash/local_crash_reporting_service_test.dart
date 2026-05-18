import 'package:echoes/core/crash/local_crash_reporting_service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('records framework and uncaught errors locally', () async {
    final service = LocalCrashReportingService();
    final error = StateError('boom');
    final details = FlutterErrorDetails(exception: error);

    await service.recordFlutterError(details);
    await service.recordError(error, StackTrace.current, fatal: true);

    expect(service.recordedFlutterErrors.single.exception, error);
    expect(service.recordedErrors.single, error);
  });
}
