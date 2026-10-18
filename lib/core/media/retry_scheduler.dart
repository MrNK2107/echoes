import 'dart:async';

import 'package:echoes/core/connectivity/connectivity_monitor.dart';
import 'package:echoes/features/memories/application/pending_memory_upload_sync.dart';

/// Schedules automatic retries of pending uploads when the device comes back
/// online, with exponential backoff between consecutive retry rounds.
class RetryScheduler {
  RetryScheduler({
    required ConnectivityMonitor connectivityMonitor,
    required PendingMemoryUploadSync uploadSync,
    this.maxDelaySeconds = 120,
  })  : _connectivityMonitor = connectivityMonitor,
        _uploadSync = uploadSync;

  final ConnectivityMonitor _connectivityMonitor;
  final PendingMemoryUploadSync _uploadSync;
  final int maxDelaySeconds;
  StreamSubscription<bool>? _connectivitySubscription;
  int _consecutiveRetries = 0;

  /// Starts listening for connectivity changes and auto-retrying uploads.
  void start() {
    _connectivitySubscription = _connectivityMonitor.onConnectivityChanged
        .listen((online) {
      if (!online) return;
      _scheduleRetry();
    });
  }

  void _scheduleRetry() {
    final delay = _backoffDelay();
    Timer(delay, () async {
      final completed = await _uploadSync.retryPendingUploads();
      if (completed > 0) {
        _consecutiveRetries = 0;
      } else {
        _consecutiveRetries++;
      }
    });
  }

  Duration _backoffDelay() {
    // Exponential backoff: 2s, 4s, 8s, ... capped at maxDelaySeconds
    final seconds = (2 << (_consecutiveRetries).clamp(0, 5))
        .clamp(1, maxDelaySeconds);
    return Duration(seconds: seconds);
  }

  /// Stops listening for connectivity changes.
  void stop() {
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
  }

  void dispose() {
    stop();
  }
}
