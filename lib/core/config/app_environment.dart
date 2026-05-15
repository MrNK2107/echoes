enum AppEnvironment {
  development,
  production;

  static AppEnvironment fromName(String name) {
    return switch (name.toLowerCase()) {
      'prod' || 'production' => AppEnvironment.production,
      _ => AppEnvironment.development,
    };
  }
}
