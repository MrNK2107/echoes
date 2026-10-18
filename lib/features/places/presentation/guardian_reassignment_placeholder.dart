import 'package:echoes/app/theme.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class GuardianReassignment extends StatefulWidget {
  const GuardianReassignment({
    required this.place,
    required this.currentUserId,
    super.key,
  });

  final Place place;
  final String currentUserId;

  @override
  State<GuardianReassignment> createState() => _GuardianReassignmentState();
}

class _GuardianReassignmentState extends State<GuardianReassignment> {
  final _searchController = TextEditingController();
  List<AppUser> _searchResults = const [];
  bool _isSearching = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _searchUsers(String query) async {
    if (query.trim().length < 2) {
      setState(() {
        _searchResults = const [];
        _isSearching = false;
      });
      return;
    }

    setState(() => _isSearching = true);
    try {
      final results = await context
          .read<AppUserRepository>()
          .searchUsers(query, limit: 10);
      if (mounted) {
        setState(() {
          _searchResults = results
              .where((u) => !widget.place.custodianIds.contains(u.id))
              .toList();
          _isSearching = false;
        });
      }
    } on Object {
      if (mounted) {
        setState(() => _isSearching = false);
      }
    }
  }

  Future<void> _addCustodian(AppUser user) async {
    final placeRepository = context.read<PlaceRepository>();
    await placeRepository.addCustodian(
      placeId: widget.place.id,
      userId: user.id,
      updatedAt: DateTime.now().toUtc(),
    );
    _searchController.clear();
    setState(() {
      _searchResults = const [];
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${user.displayName ?? user.id} added as custodian'),
        ),
      );
    }
  }

  Future<void> _removeCustodian(String userId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove custodian'),
        content: const Text(
          'This person will lose the ability to manage this place. '
          'Memories they created here will remain.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    await context.read<PlaceRepository>().removeCustodian(
      placeId: widget.place.id,
      userId: userId,
      updatedAt: DateTime.now().toUtc(),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.place.custodianIds.contains(widget.currentUserId)) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Custodians',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: EchoesColors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        ...widget.place.custodianIds.map(
          (id) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                const Icon(
                  Icons.admin_panel_settings_outlined,
                  size: 20,
                  color: EchoesColors.textSecondary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    id == widget.currentUserId ? '$id (you)' : id,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: EchoesColors.textPrimary,
                    ),
                  ),
                ),
                if (id != widget.currentUserId)
                  IconButton(
                    icon: const Icon(Icons.remove_circle_outline, size: 20),
                    color: EchoesColors.textSecondary,
                    onPressed: () => _removeCustodian(id),
                    tooltip: 'Remove custodian',
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Search users to add as custodian...',
            prefixIcon: _isSearching
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: Center(
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  )
                : const Icon(Icons.search),
            suffixIcon: _searchResults.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _searchResults = const [];
                      });
                    },
                  )
                : null,
          ),
          onChanged: _searchUsers,
        ),
        if (_searchResults.isNotEmpty) ...[
          const SizedBox(height: 4),
          DecoratedBox(
            decoration: BoxDecoration(
              color: EchoesColors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: EchoesColors.elevatedSurface),
            ),
            child: Column(
              children: [
                for (final user in _searchResults) ...[
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.person_outline),
                    title: Text(user.displayName ?? user.id),
                    subtitle: user.email != null ? Text(user.email!) : null,
                    trailing: const Icon(Icons.person_add_alt_1, size: 18),
                    onTap: () => _addCustodian(user),
                  ),
                  if (user != _searchResults.last)
                    const Divider(height: 1, indent: 16),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
