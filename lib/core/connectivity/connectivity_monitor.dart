import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

/// Monitors network connectivity and emits state changes.
class ConnectivityMonitor {
  ConnectivityMonitor({Connectivity? connectivity})
    : _connectivity = connectivity ?? Connectivity() {
    _subscription = _connectivity.onConnectivityChanged.listen(_handleResults);
    unawaited(_initialize());
  }

  final Connectivity _connectivity;
  final _controller = StreamController<bool>.broadcast();
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  bool _isOnline = true;

  Stream<bool> get onConnectivityChanged => _controller.stream;

  bool get isOnline => _isOnline;

  void update(bool online) {
    if (_isOnline == online) return;
    _isOnline = online;
    _controller.add(online);
  }

  Future<void> _initialize() async {
    _handleResults(await _connectivity.checkConnectivity());
  }

  void _handleResults(List<ConnectivityResult> results) {
    update(results.any((result) => result != ConnectivityResult.none));
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    await _controller.close();
  }
}
