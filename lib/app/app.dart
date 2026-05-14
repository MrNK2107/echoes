import 'package:echoes/app/theme.dart';
import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_gate.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class EchoesApp extends StatelessWidget {
  const EchoesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ECHOES',
      debugShowCheckedModeBanner: false,
      theme: EchoesTheme.dark,
      home: RepositoryProvider<AuthRepository>(
        create: (_) => LocalAuthRepository(),
        child: BlocProvider(
          create: (context) =>
              AuthCubit(repository: context.read<AuthRepository>())..start(),
          child: const AuthGate(),
        ),
      ),
    );
  }
}
