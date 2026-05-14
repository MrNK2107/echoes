import 'package:echoes/shared/widgets/feature_placeholder.dart';
import 'package:echoes/app/theme.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ProfilePlaceholderScreen extends StatelessWidget {
  const ProfilePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        final session = state.session;

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (session == null)
                  const Expanded(
                    child: FeaturePlaceholder(
                      icon: Icons.account_circle_outlined,
                      title: 'Custodianship starts here.',
                      description:
                          'Profiles will show created memories, managed places, legacy transfers, and privacy defaults.',
                      nextStep:
                          'Next: implement Firebase Auth and create user profile documents after signup.',
                    ),
                  )
                else ...[
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: EchoesColors.celestialBlue.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.account_circle_outlined,
                      color: EchoesColors.celestialBlue,
                      size: 34,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    session.displayName ?? 'Echoes custodian',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: EchoesColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    session.email,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: EchoesColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const _ProfileStatRow(),
                  const Spacer(),
                  OutlinedButton.icon(
                    key: const ValueKey('signOutButton'),
                    onPressed: () => context.read<AuthCubit>().signOut(),
                    icon: const Icon(Icons.logout),
                    label: const Text('Sign out'),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ProfileStatRow extends StatelessWidget {
  const _ProfileStatRow();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: const [
        Expanded(
          child: _ProfileStat(label: 'Memories', value: '0'),
        ),
        SizedBox(width: 12),
        Expanded(
          child: _ProfileStat(label: 'Places', value: '0'),
        ),
      ],
    );
  }
}

class _ProfileStat extends StatelessWidget {
  const _ProfileStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoesColors.elevatedSurface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: EchoesColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
