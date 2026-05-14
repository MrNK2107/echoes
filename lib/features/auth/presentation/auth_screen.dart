import 'package:echoes/app/theme.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_state.dart';
import 'package:echoes/features/auth/presentation/auth_status.dart';
import 'package:echoes/features/auth/presentation/auth_validators.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isRegistering = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthCubit, AuthState>(
      listener: (context, state) {
        if (state.status == AuthStatus.failure && state.errorMessage != null) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
        }
      },
      builder: (context, state) {
        final isSubmitting = state.status == AuthStatus.submitting;

        return Scaffold(
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const _AuthHeader(),
                        const SizedBox(height: 32),
                        if (_isRegistering) ...[
                          TextFormField(
                            key: const ValueKey('displayNameField'),
                            controller: _nameController,
                            textInputAction: TextInputAction.next,
                            validator: AuthValidators.displayName,
                            decoration: const InputDecoration(
                              labelText: 'Name',
                              prefixIcon: Icon(Icons.person_outline),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        TextFormField(
                          key: const ValueKey('emailField'),
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          validator: AuthValidators.email,
                          decoration: const InputDecoration(
                            labelText: 'Email',
                            prefixIcon: Icon(Icons.mail_outline),
                          ),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          key: const ValueKey('passwordField'),
                          controller: _passwordController,
                          obscureText: true,
                          textInputAction: TextInputAction.done,
                          validator: AuthValidators.password,
                          onFieldSubmitted: (_) => _submit(),
                          decoration: const InputDecoration(
                            labelText: 'Password',
                            prefixIcon: Icon(Icons.lock_outline),
                          ),
                        ),
                        const SizedBox(height: 24),
                        FilledButton.icon(
                          key: const ValueKey('authSubmitButton'),
                          onPressed: isSubmitting ? null : _submit,
                          icon: isSubmitting
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Icon(
                                  _isRegistering
                                      ? Icons.person_add_alt_1
                                      : Icons.login,
                                ),
                          label: Text(
                            _isRegistering ? 'Create account' : 'Sign in',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          key: const ValueKey('authModeToggleButton'),
                          onPressed: isSubmitting
                              ? null
                              : () {
                                  setState(
                                    () => _isRegistering = !_isRegistering,
                                  );
                                },
                          child: Text(
                            _isRegistering
                                ? 'Already have an account? Sign in'
                                : 'New to ECHOES? Create an account',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final cubit = context.read<AuthCubit>();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (_isRegistering) {
      cubit.register(
        email: email,
        password: password,
        displayName: _nameController.text.trim(),
      );
    } else {
      cubit.signIn(email: email, password: password);
    }
  }
}

class _AuthHeader extends StatelessWidget {
  const _AuthHeader();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            color: EchoesColors.sunsetGold.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Icon(
            Icons.place_outlined,
            color: EchoesColors.sunsetGold,
            size: 34,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'ECHOES',
          style: textTheme.headlineLarge?.copyWith(
            color: EchoesColors.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Places hold more memories than people do.',
          style: textTheme.bodyLarge?.copyWith(
            color: EchoesColors.textSecondary,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}
