import 'dart:async';

import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_state.dart';
import 'package:echoes/features/auth/presentation/auth_status.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit({required AuthRepository repository})
    : _repository = repository,
      super(const AuthState.unknown());

  final AuthRepository _repository;
  StreamSubscription<void>? _sessionSubscription;

  void start() {
    _sessionSubscription?.cancel();
    _sessionSubscription = _repository.watchSession().listen((session) {
      emit(
        AuthState(
          status: session == null
              ? AuthStatus.unauthenticated
              : AuthStatus.authenticated,
          session: session,
        ),
      );
    });
  }

  Future<void> signIn({required String email, required String password}) async {
    await _runAuthAction(
      () => _repository.signInWithEmail(email: email, password: password),
    );
  }

  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    await _runAuthAction(
      () => _repository.registerWithEmail(
        email: email,
        password: password,
        displayName: displayName,
      ),
    );
  }

  Future<void> signOut() async {
    await _repository.signOut();
  }

  Future<void> _runAuthAction(Future<void> Function() action) async {
    emit(state.copyWith(status: AuthStatus.submitting));
    try {
      await action();
    } on Object catch (error) {
      emit(
        AuthState(
          status: AuthStatus.failure,
          session: state.session,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  @override
  Future<void> close() {
    _sessionSubscription?.cancel();
    return super.close();
  }
}
