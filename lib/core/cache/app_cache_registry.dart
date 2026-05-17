abstract interface class AppCacheClient {
  String get cacheLabel;

  int get cachedItemCount;

  void clearCache();
}

class AppCacheRegistry {
  final List<AppCacheClient> _clients = [];

  void register(AppCacheClient client) {
    if (!_clients.contains(client)) {
      _clients.add(client);
    }
  }

  int get cachedItemCount {
    return _clients.fold<int>(
      0,
      (count, client) => count + client.cachedItemCount,
    );
  }

  void clearAll() {
    for (final client in _clients) {
      client.clearCache();
    }
  }
}
