import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:flutter/widgets.dart';

class LocalImageCache implements AppCacheClient {
  final Map<String, ImageProvider> _providersByUrl = {};

  @override
  String get cacheLabel => 'Images';

  @override
  int get cachedItemCount => _providersByUrl.length;

  ImageProvider providerFor(String imageUrl) {
    return _providersByUrl.putIfAbsent(imageUrl, () => NetworkImage(imageUrl));
  }

  @override
  void clearCache() {
    for (final provider in _providersByUrl.values) {
      provider.evict();
    }
    _providersByUrl.clear();
  }
}
