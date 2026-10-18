import 'dart:async';

import 'package:echoes/app/theme.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

/// A search field for finding users with debounced input.
///
/// Useful for tagging users in memories, adding custodians, or inviting
/// community members. Results are returned via [onUserSelected].
class UserSearchField extends StatefulWidget {
  const UserSearchField({
    required this.onUserSelected,
    this.excludeUserIds = const [],
    this.labelText = 'Search users...',
    super.key,
  });

  final ValueChanged<AppUser> onUserSelected;
  final List<String> excludeUserIds;
  final String labelText;

  @override
  State<UserSearchField> createState() => _UserSearchFieldState();
}

class _UserSearchFieldState extends State<UserSearchField> {
  final _controller = TextEditingController();
  final _debounce = Debouncer(milliseconds: 300);
  List<AppUser> _results = const [];
  bool _isSearching = false;
  bool _hasSearched = false;

  @override
  void dispose() {
    _controller.dispose();
    _debounce.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    if (query.trim().length < 2) {
      setState(() {
        _results = const [];
        _isSearching = false;
        _hasSearched = false;
      });
      return;
    }

    setState(() => _isSearching = true);
    _debounce.run(() async {
      try {
        final users = await context
            .read<AppUserRepository>()
            .searchUsers(query, limit: 10);
        if (mounted) {
          setState(() {
            _results = users
                .where((u) => !widget.excludeUserIds.contains(u.id))
                .toList();
            _isSearching = false;
            _hasSearched = true;
          });
        }
      } on Object {
        if (mounted) {
          setState(() {
            _isSearching = false;
            _hasSearched = true;
          });
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _controller,
          decoration: InputDecoration(
            labelText: widget.labelText,
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
            suffixIcon: _results.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _controller.clear();
                      setState(() {
                        _results = const [];
                        _hasSearched = false;
                      });
                    },
                  )
                : null,
          ),
          onChanged: _onSearchChanged,
        ),
        if (_results.isNotEmpty) ...[
          const SizedBox(height: 4),
          DecoratedBox(
            decoration: BoxDecoration(
              color: EchoesColors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: EchoesColors.elevatedSurface),
            ),
            child: Column(
              children: [
                for (final user in _results) ...[
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.person_outline),
                    title: Text(user.displayName ?? user.id),
                    subtitle: user.email != null ? Text(user.email!) : null,
                    trailing: const Icon(Icons.person_add_alt_1, size: 18),
                    onTap: () {
                      widget.onUserSelected(user);
                      _controller.clear();
                      setState(() {
                        _results = const [];
                        _hasSearched = false;
                      });
                    },
                  ),
                  if (user != _results.last) const Divider(height: 1, indent: 16),
                ],
              ],
            ),
          ),
        ],
        if (_hasSearched && _results.isEmpty && !_isSearching) ...[
          const SizedBox(height: 4),
          Text(
            'No users found.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: EchoesColors.textSecondary,
            ),
          ),
        ],
      ],
    );
  }
}

/// Simple debouncer that delays execution until [milliseconds] have passed
/// since the last call to [run].
class Debouncer {
  Debouncer({required this.milliseconds});

  final int milliseconds;
  Timer? _timer;

  void run(VoidCallback action) {
    _timer?.cancel();
    _timer = Timer(Duration(milliseconds: milliseconds), action);
  }

  void dispose() {
    _timer?.cancel();
  }
}
