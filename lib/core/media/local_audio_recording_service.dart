import 'package:echoes/core/media/audio_recording_service.dart';

class LocalAudioRecordingService implements AudioRecordingService {
  bool _recording = false;

  @override
  Future<bool> hasPermission() async => true;

  @override
  Future<void> start() async => _recording = true;

  @override
  Future<String?> stop() async {
    if (!_recording) return null;
    _recording = false;
    return 'memory-note.m4a';
  }

  @override
  Future<void> cancel() async => _recording = false;

  @override
  Future<void> dispose() async {}
}
