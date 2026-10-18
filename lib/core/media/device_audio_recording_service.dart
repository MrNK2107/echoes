import 'package:echoes/core/media/audio_recording_service.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

class DeviceAudioRecordingService implements AudioRecordingService {
  DeviceAudioRecordingService({AudioRecorder? recorder})
    : _recorder = recorder ?? AudioRecorder();

  final AudioRecorder _recorder;

  @override
  Future<bool> hasPermission() => _recorder.hasPermission();

  @override
  Future<void> start() async {
    final directory = await getTemporaryDirectory();
    final path =
        '${directory.path}/echoes-${DateTime.now().microsecondsSinceEpoch}.m4a';
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 96000,
        sampleRate: 44100,
      ),
      path: path,
    );
  }

  @override
  Future<String?> stop() => _recorder.stop();

  @override
  Future<void> cancel() => _recorder.cancel();

  @override
  Future<void> dispose() => _recorder.dispose();
}
