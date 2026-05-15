import 'dart:async';

import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_session.dart';
import 'package:echoes/features/auth/presentation/auth_state.dart';
import 'package:echoes/features/auth/presentation/auth_status.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required AuthRepository repository,
    required AppUserRepository userRepository,
  }) : _repository = repository,
       _userRepository = userRepository,
       super(const AuthState.unknown());

  final AuthRepository _repository;
  final AppUserRepository _userRepository;
  StreamSubscription<AuthSession?>? _sessionSubscription;

  void start() {
    _sessionSubscription?.cancel();
    _sessionSubscription = _repository.watchSession().listen((session) async {
      await _userRepository.setCurrentUserId(session?.userId);
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
    await _runAuthAction(() async {
      final session = await _repository.signInWithEmail(
        email: email,
        password: password,
      );
      await _ensureProfile(
        userId: session.userId,
        email: session.email,
        displayName: session.displayName,
      );
    });
  }

  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    await _runAuthAction(() async {
      final session = await _repository.registerWithEmail(
        email: email,
        password: password,
        displayName: displayName,
      );
      await _ensureProfile(
        userId: session.userId,
        email: session.email,
        displayName: session.displayName,
      );
    });
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

  Future<void> _ensureProfile({
    required String userId,
    required String email,
    required String? displayName,
  }) async {
    final existing = await _userRepository.findById(userId);
    if (existing != null) {
      await _userRepository.setCurrentUserId(userId);
      return;
    }

    final now = DateTime.now().toUtc();
    await _userRepository.create(
      AppUser(
        id: userId,
        displayName: displayName,
        email: email,
        defaultPrivacy: PrivacyType.public,
        managedPlaceIds: const [],
        communityIds: const [],
        createdAt: now,
        updatedAt: now,
      ),
    );
    await _userRepository.setCurrentUserId(userId);
  }

  @override
  Future<void> close() {
    _sessionSubscription?.cancel();
    return super.close();
  }
}
