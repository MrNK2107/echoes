import 'package:echoes/features/auth/domain/auth_session.dart';
import 'package:echoes/features/auth/presentation/auth_status.dart';
import 'package:equatable/equatable.dart';

class AuthState extends Equatable {
  const AuthState({required this.status, this.session, this.errorMessage});

  const AuthState.unknown() : this(status: AuthStatus.unknown);

  final AuthStatus status;
  final AuthSession? session;
  final String? errorMessage;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: session ?? this.session,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, session, errorMessage];
}
