import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppCacheRegistry', () {
    test('tracks and clears registered cache clients', () {
      final registry = AppCacheRegistry();
      final first = _FakeCacheClient(cachedItemCount: 2);
      final second = _FakeCacheClient(cachedItemCount: 3);

      registry
        ..register(first)
        ..register(second)
        ..register(first);

      expect(registry.cachedItemCount, 5);

      registry.clearAll();

      expect(first.cleared, isTrue);
      expect(second.cleared, isTrue);
      expect(registry.cachedItemCount, isZero);
    });
  });
}

class _FakeCacheClient implements AppCacheClient {
  _FakeCacheClient({required this.cachedItemCount});

  @override
  final String cacheLabel = 'Fake cache';

  @override
  int cachedItemCount;

  bool cleared = false;

  @override
  void clearCache() {
    cleared = true;
    cachedItemCount = 0;
  }
}
