import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:flutter/widgets.dart';

class LocalImageCache implements AppCacheClient {
  final Map<String, LocalImageCacheEntry> _entriesByUrl = {};

  @override
  String get cacheLabel => 'Images';

  @override
  int get cachedItemCount => _entriesByUrl.length;

  ImageProvider providerFor(String imageUrl) {
    return entryFor(imageUrl).provider;
  }

  LocalImageCacheEntry entryFor(String imageUrl) {
    return _entriesByUrl.putIfAbsent(
      imageUrl,
      () => LocalImageCacheEntry(
        imageUrl: imageUrl,
        thumbnailKey: _thumbnailKeyFor(imageUrl),
        provider: NetworkImage(imageUrl),
        cachedAt: DateTime.now().toUtc(),
      ),
    );
  }

  @override
  void clearCache() {
    for (final entry in _entriesByUrl.values) {
      entry.provider.evict();
    }
    _entriesByUrl.clear();
  }

  String _thumbnailKeyFor(String imageUrl) {
    return imageUrl.hashCode.toUnsigned(32).toRadixString(16).padLeft(8, '0');
  }
}

class LocalImageCacheEntry {
  const LocalImageCacheEntry({
    required this.imageUrl,
    required this.thumbnailKey,
    required this.provider,
    required this.cachedAt,
  });

  final String imageUrl;
  final String thumbnailKey;
  final ImageProvider provider;
  final DateTime cachedAt;
}
