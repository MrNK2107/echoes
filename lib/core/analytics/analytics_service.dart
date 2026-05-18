abstract interface class AnalyticsService {
  Future<void> setCollectionEnabled(bool enabled);

  Future<void> logAppOpened();

  Future<void> logFeatureViewed(String featureName);
}
