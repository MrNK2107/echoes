class AuthSession {
  const AuthSession({
    required this.userId,
    required this.email,
    this.displayName,
  });

  final String userId;
  final String email;
  final String? displayName;
}
