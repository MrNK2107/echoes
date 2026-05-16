class PendingMemoryUpload {
  const PendingMemoryUpload({
    required this.memoryId,
    required this.userId,
    required this.imagePath,
    required this.createdAt,
    this.attempts = 0,
    this.lastAttemptAt,
  }) : assert(attempts >= 0);

  final String memoryId;
  final String userId;
  final String imagePath;
  final DateTime createdAt;
  final int attempts;
  final DateTime? lastAttemptAt;

  PendingMemoryUpload copyWith({
    String? memoryId,
    String? userId,
    String? imagePath,
    DateTime? createdAt,
    int? attempts,
    DateTime? lastAttemptAt,
  }) {
    return PendingMemoryUpload(
      memoryId: memoryId ?? this.memoryId,
      userId: userId ?? this.userId,
      imagePath: imagePath ?? this.imagePath,
      createdAt: createdAt ?? this.createdAt,
      attempts: attempts ?? this.attempts,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
    );
  }
}
