import 'package:echoes/core/media/local_image_cache.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('LocalImageCache reuses providers and clears cached images', () {
    final cache = LocalImageCache();

    final firstProvider = cache.providerFor('https://example.com/memory.jpg');
    final secondProvider = cache.providerFor('https://example.com/memory.jpg');
    final otherProvider = cache.providerFor('https://example.com/other.jpg');

    expect(firstProvider, same(secondProvider));
    expect(otherProvider, isNot(same(firstProvider)));
    expect(cache.cachedItemCount, 2);

    cache.clearCache();

    expect(cache.cachedItemCount, 0);
  });
}
