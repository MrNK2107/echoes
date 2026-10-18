import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class MemoryAudioPlayer extends StatefulWidget {
  const MemoryAudioPlayer({required this.audioUrl, super.key});

  final String audioUrl;

  @override
  State<MemoryAudioPlayer> createState() => _MemoryAudioPlayerState();
}

class _MemoryAudioPlayerState extends State<MemoryAudioPlayer> {
  static const _channel = MethodChannel('echoes/audio');
  bool _playing = false;
  Object? _error;

  @override
  void dispose() {
    _channel.invokeMethod<void>('stop');
    super.dispose();
  }

  Future<void> _toggle() async {
    try {
      if (_playing) {
        await _channel.invokeMethod<void>('pause');
      } else {
        await _channel.invokeMethod<void>('play', {'url': widget.audioUrl});
      }
      if (mounted) {
        setState(() {
          _playing = !_playing;
          _error = null;
        });
      }
    } on Object catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Memory voice note',
      child: Row(
        children: [
          IconButton.filledTonal(
            key: const ValueKey('memoryAudioPlayButton'),
            tooltip: _playing ? 'Pause voice note' : 'Play voice note',
            onPressed: _toggle,
            icon: Icon(_playing ? Icons.pause : Icons.play_arrow),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _error == null ? 'Voice note' : 'Voice note unavailable',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: _error == null
                    ? EchoesColors.textPrimary
                    : EchoesColors.sunsetGold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
