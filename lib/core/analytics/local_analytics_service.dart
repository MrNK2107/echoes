import 'package:echoes/core/analytics/analytics_service.dart';

class LocalAnalyticsService implements AnalyticsService {
  final List<String> events = [];
  var collectionEnabled = true;

  @override
  Future<void> logAppOpened() async {
    if (collectionEnabled) {
      events.add('app_open');
    }
  }

  @override
  Future<void> logFeatureViewed(String featureName) async {
    if (collectionEnabled) {
      events.add('feature_viewed:${featureName.trim()}');
    }
  }

  @override
  Future<void> setCollectionEnabled(bool enabled) async {
    collectionEnabled = enabled;
  }
}
