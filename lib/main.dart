import 'package:echoes/app/app.dart';
import 'package:echoes/app/bootstrap.dart';
import 'package:echoes/core/config/firebase_bootstrap.dart';
import 'package:echoes/core/crash/crash_reporting_service.dart';
import 'package:echoes/core/crash/firebase_crash_reporting_service.dart';
import 'package:echoes/features/notifications/data/firebase_push_notification_service.dart';
import 'package:flutter/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await FirebaseBootstrap.initialize();

  try {
    FirebasePushNotificationService.registerBackgroundHandler();
  } on Object {
    // FCM background handler registration is non-critical for startup.
  }

  final crashReporting = _crashReportingService();
  bootstrap(
    () => const EchoesApp(useFirebase: true),
    crashReporting: crashReporting,
  );
}

CrashReportingService? _crashReportingService() {
  try {
    return FirebaseCrashReportingService();
  } on Object {
    return null;
  }
}
