import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_screen.dart';
import 'package:echoes/features/auth/presentation/auth_state.dart';
import 'package:echoes/features/auth/presentation/auth_status.dart';
import 'package:echoes/features/home/presentation/echoes_home_shell.dart';
import 'package:echoes/features/splash/presentation/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        return switch (state.status) {
          AuthStatus.unknown => const SplashScreen(),
          AuthStatus.authenticated => const EchoesHomeShell(),
          AuthStatus.unauthenticated ||
          AuthStatus.submitting ||
          AuthStatus.failure => const AuthScreen(),
        };
      },
    );
  }
}
