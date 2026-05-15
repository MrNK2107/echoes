import 'package:echoes/core/config/app_environment.dart';

class AppConfig {
  const AppConfig({required this.environment});

  factory AppConfig.fromEnvironment() {
    const environmentName = String.fromEnvironment(
      'ECHOES_ENV',
      defaultValue: 'development',
    );
    return AppConfig(environment: AppEnvironment.fromName(environmentName));
  }

  final AppEnvironment environment;

  bool get isProduction => environment == AppEnvironment.production;

  String get appTitle {
    return isProduction ? 'ECHOES' : 'ECHOES Dev';
  }
}
