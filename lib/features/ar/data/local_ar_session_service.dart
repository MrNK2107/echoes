import 'package:echoes/features/ar/domain/ar_session_service.dart';

class LocalArSessionService implements ArSessionService {
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
