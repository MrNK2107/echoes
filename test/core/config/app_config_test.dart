import 'package:echoes/core/config/app_config.dart';
import 'package:echoes/core/config/app_environment.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppConfig', () {
    test('uses development title outside production', () {
      const config = AppConfig(environment: AppEnvironment.development);

      expect(config.appTitle, 'ECHOES Dev');
      expect(config.isProduction, isFalse);
    });

    test('uses production title for production builds', () {
      const config = AppConfig(environment: AppEnvironment.production);

      expect(config.appTitle, 'ECHOES');
      expect(config.isProduction, isTrue);
    });
  });

  group('AppEnvironment', () {
    test('parses production aliases', () {
      expect(AppEnvironment.fromName('prod'), AppEnvironment.production);
      expect(AppEnvironment.fromName('production'), AppEnvironment.production);
    });

    test('defaults unknown names to development', () {
      expect(AppEnvironment.fromName('staging'), AppEnvironment.development);
    });
  });
}
