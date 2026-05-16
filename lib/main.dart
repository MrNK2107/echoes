import 'package:echoes/app/app.dart';
import 'package:echoes/app/bootstrap.dart';
import 'package:echoes/core/config/firebase_bootstrap.dart';

Future<void> main() async {
  await FirebaseBootstrap.initialize();
  bootstrap(() => const EchoesApp(useFirebase: true));
}
