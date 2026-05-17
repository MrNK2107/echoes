import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:echoes/features/profile/presentation/cache_management_settings.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('clears registered warm caches', (tester) async {
    final registry = AppCacheRegistry();
    registry.register(_FakeCacheClient(cachedItemCount: 4));

    await tester.pumpWidget(
      RepositoryProvider<AppCacheRegistry>.value(
        value: registry,
        child: const MaterialApp(
          home: Scaffold(body: CacheManagementSettings()),
        ),
      ),
    );

    expect(find.text('Cached data'), findsOneWidget);
    expect(find.text('4'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('clearCacheButton')));
    await tester.pumpAndSettle();

    expect(registry.cachedItemCount, isZero);
    expect(find.text('0'), findsOneWidget);
    expect(find.text('Cleared 4 cached item(s).'), findsOneWidget);
  });
}

class _FakeCacheClient implements AppCacheClient {
  _FakeCacheClient({required this.cachedItemCount});

  @override
  final String cacheLabel = 'Fake cache';

  @override
  int cachedItemCount;

  @override
  void clearCache() {
    cachedItemCount = 0;
  }
}
