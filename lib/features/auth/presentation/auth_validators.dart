class AuthValidators {
  static String? email(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return 'Email is required';
    }
    if (!trimmed.contains('@') || !trimmed.contains('.')) {
      return 'Enter a valid email';
    }
    return null;
  }

  static String? password(String? value) {
    final password = value ?? '';
    if (password.isEmpty) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Use at least 8 characters';
    }
    return null;
  }

  static String? displayName(String? value) {
    if ((value?.trim() ?? '').isEmpty) {
      return 'Name is required';
    }
    return null;
  }
}
