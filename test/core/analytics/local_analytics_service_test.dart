import 'package:echoes/core/analytics/local_analytics_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('records only reviewed local analytics events when enabled', () async {
    final service = LocalAnalyticsService();

    await service.logAppOpened();
    await service.logFeatureViewed('Map');

    expect(service.events, ['app_open', 'feature_viewed:Map']);
  });

  test('suppresses local analytics when collection is disabled', () async {
    final service = LocalAnalyticsService();

    await service.setCollectionEnabled(false);
    await service.logAppOpened();
    await service.logFeatureViewed('Profile');

    expect(service.events, isEmpty);
  });
}
