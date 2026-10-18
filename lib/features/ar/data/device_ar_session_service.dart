import 'package:echoes/features/ar/domain/ar_session_service.dart';

/// Platform-aware AR session service.
///
/// This coordinates the presentation lifecycle. `NativeArScene` owns the
/// platform-specific ARCore/ARKit controllers because those controllers are
/// created and disposed with their native platform views.
class DeviceArSessionService implements ArSessionService {
  bool _isRunning = false;

  bool get isRunning => _isRunning;

  @override
  Future<void> start() async {
    _isRunning = true;
  }

  @override
  Future<void> stop() async {
    _isRunning = false;
  }
}
