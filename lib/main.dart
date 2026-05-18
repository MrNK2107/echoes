import 'package:echoes/app/app.dart';
import 'package:echoes/app/bootstrap.dart';
import 'package:echoes/core/config/firebase_bootstrap.dart';
import 'package:echoes/core/crash/firebase_crash_reporting_service.dart';
import 'package:echoes/features/notifications/data/firebase_push_notification_service.dart';

Future<void> main() async {
  await FirebaseBootstrap.initialize();
  FirebasePushNotificationService.registerBackgroundHandler();
  bootstrap(
    () => const EchoesApp(useFirebase: true),
    crashReporting: FirebaseCrashReportingService(),
  );
}
