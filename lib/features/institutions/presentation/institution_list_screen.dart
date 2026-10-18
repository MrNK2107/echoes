import 'package:echoes/app/theme.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';
import 'package:echoes/features/institutions/presentation/institution_detail_screen.dart';
import 'package:echoes/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

class InstitutionListScreen extends StatelessWidget {
  const InstitutionListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthCubit>().state.session;
    if (session == null) {
      return const SizedBox.shrink();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Institutions'),
        actions: [
          IconButton.filledTonal(
            key: const ValueKey('createInstitutionButton'),
            onPressed: () => _showCreateSheet(context, session.userId),
            icon: const Icon(Icons.add),
            tooltip: 'Register institution',
          ),
        ],
      ),
      body: _InstitutionList(userId: session.userId),
    );
  }

  void _showCreateSheet(BuildContext context, String userId) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _CreateInstitutionSheet(userId: userId),
    );
  }
}

class _InstitutionList extends StatelessWidget {
  const _InstitutionList({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<InstitutionZone>>(
      stream: context.read<InstitutionRepository>().watchInstitutions(),
      builder: (context, snapshot) {
        final zones = snapshot.data ?? const <InstitutionZone>[];

        if (zones.isEmpty) {
          return const EmptyState(
            icon: Icons.account_balance_outlined,
            title: 'No institutions yet.',
            description:
                'Register a school, university, or venue to manage its memory zones.',
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: zones.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final zone = zones[index];
            final isVerified =
                zone.verifiedAdminUserIds.contains(userId);
            return Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                leading: const Icon(Icons.account_balance_outlined),
                title: Text(zone.name),
                subtitle: Text(
                  '${zone.allowedEmailDomains.length} domain(s) · '
                  '${zone.verifiedAdminUserIds.length} admin(s) · '
                  '${zone.subZones.length} sub-zone(s)',
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isVerified)
                      const Icon(Icons.verified, color: EchoesColors.celestialBlue, size: 20),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right),
                  ],
                ),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        InstitutionDetailScreen(zone: zone, userId: userId),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _CreateInstitutionSheet extends StatefulWidget {
  const _CreateInstitutionSheet({required this.userId});

  final String userId;

  @override
  State<_CreateInstitutionSheet> createState() =>
      _CreateInstitutionSheetState();
}

class _CreateInstitutionSheetState extends State<_CreateInstitutionSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _domainsController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _domainsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Register institution',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              validator: (value) =>
                  (value?.trim() ?? '').isEmpty ? 'Name is required' : null,
              decoration: const InputDecoration(labelText: 'Institution name'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _domainsController,
              validator: (value) => (value?.trim() ?? '').isEmpty
                  ? 'At least one email domain is required'
                  : null,
              decoration: const InputDecoration(
                labelText: 'Allowed email domains',
                helperText: 'Separate multiple domains with commas, e.g. uv.edu, alumni.uv.edu',
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
              label: const Text('Register'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final domains = _domainsController.text
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .where((d) => d.isNotEmpty)
        .toList(growable: false);

    final zone = InstitutionZone(
      id: const Uuid().v4(),
      name: _nameController.text.trim(),
      allowedEmailDomains: domains,
    );

    await context.read<InstitutionRepository>().create(zone);

    if (mounted) Navigator.of(context).pop();
  }
}
