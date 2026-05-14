class MemoryValidators {
  static String? text(String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return 'Memory text is required';
    }
    if (trimmed.length > 2000) {
      return 'Keep memories under 2000 characters';
    }
    return null;
  }
}
