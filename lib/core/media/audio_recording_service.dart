abstract interface class AudioRecordingService {
  Future<bool> hasPermission();

  Future<void> start();

  Future<String?> stop();

  Future<void> cancel();

  Future<void> dispose();
}
