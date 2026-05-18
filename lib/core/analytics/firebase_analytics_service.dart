import 'package:echoes/core/analytics/analytics_service.dart';
import 'package:firebase_analytics/firebase_analytics.dart';

class FirebaseAnalyticsService implements AnalyticsService {
  FirebaseAnalyticsService({FirebaseAnalytics? analytics})
    : _analytics = analytics ?? FirebaseAnalytics.instance;

  final FirebaseAnalytics _analytics;

  @override
  Future<void> logAppOpened() {
    return _analytics.logAppOpen();
  }

  @override
  Future<void> logFeatureViewed(String featureName) {
    return _analytics.logEvent(
      name: 'feature_viewed',
      parameters: {'feature': _sanitizeFeatureName(featureName)},
    );
  }

  @override
  Future<void> setCollectionEnabled(bool enabled) {
    return _analytics.setAnalyticsCollectionEnabled(enabled);
  }

  String _sanitizeFeatureName(String featureName) {
    final sanitized = featureName
        .trim()
        .toLowerCase()
        .replaceAll(RegExp('[^a-z0-9_]+'), '_')
        .replaceAll(RegExp('_+'), '_')
        .replaceAll(RegExp('^_|_\$'), '');
    return sanitized.isEmpty ? 'unknown' : sanitized;
  }
}
