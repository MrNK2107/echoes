import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_validators.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class EditMemorySheet extends StatefulWidget {
  const EditMemorySheet({required this.memory, super.key});

  final Memory memory;

  @override
  State<EditMemorySheet> createState() => _EditMemorySheetState();
}

class _EditMemorySheetState extends State<EditMemorySheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _textController;
  late final TextEditingController _taggedUserController;
  late PrivacyType _privacy;
  late List<String> _taggedUserIds;
  DateTime? _releaseDate;
  String? _communityId;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.memory.textContent);
    _taggedUserController = TextEditingController();
    _privacy = widget.memory.privacy;
    _taggedUserIds = List<String>.from(widget.memory.taggedUserIds);
    _releaseDate = widget.memory.releaseDate;
    _communityId = widget.memory.communityId;
  }

  @override
  void dispose() {
    _textController.dispose();
    _taggedUserController.dispose();
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
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Edit memory', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextFormField(
                key: const ValueKey('editMemoryTextField'),
                controller: _textController,
                minLines: 4,
                maxLines: 6,
                maxLength: 2000,
                validator: MemoryValidators.text,
                decoration: const InputDecoration(labelText: 'Memory'),
              ),
              const SizedBox(height: 12),
              SegmentedButton<PrivacyType>(
                key: const ValueKey('editMemoryPrivacySelector'),
                segments: const [
                  ButtonSegment(
                    value: PrivacyType.public,
                    icon: Icon(Icons.public),
                    label: Text('Public'),
                  ),
                  ButtonSegment(
                    value: PrivacyType.private,
                    icon: Icon(Icons.lock_outline),
                    label: Text('Private'),
                  ),
                  ButtonSegment(
                    value: PrivacyType.tagged,
                    icon: Icon(Icons.alternate_email),
                    label: Text('Tagged'),
                  ),
                  ButtonSegment(
                    value: PrivacyType.timeRelease,
                    icon: Icon(Icons.schedule),
                    label: Text('Later'),
                  ),
                  ButtonSegment(
                    value: PrivacyType.community,
                    icon: Icon(Icons.groups_outlined),
                    label: Text('Group'),
                  ),
                ],
                selected: {_privacy},
                onSelectionChanged: (selection) {
                  setState(() => _privacy = selection.first);
                },
              ),
              const SizedBox(height: 12),
              _privacyOptions(),
              const SizedBox(height: 20),
              FilledButton.icon(
                key: const ValueKey('saveEditedMemoryButton'),
                onPressed: _save,
                icon: const Icon(Icons.save_outlined),
                label: const Text('Save changes'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _privacyOptions() {
    return switch (_privacy) {
      PrivacyType.tagged => _TaggedUserEditor(
        taggedUserIds: _taggedUserIds,
        controller: _taggedUserController,
        onAdd: (userId) {
          final trimmed = userId.trim();
          if (trimmed.isNotEmpty && !_taggedUserIds.contains(trimmed)) {
            setState(() => _taggedUserIds = [..._taggedUserIds, trimmed]);
            _taggedUserController.clear();
          }
        },
        onRemove: (userId) {
          setState(
            () => _taggedUserIds = _taggedUserIds
                .where((id) => id != userId)
                .toList(growable: false),
          );
        },
      ),
      PrivacyType.timeRelease => _ReleaseDateEditor(
        releaseDate: _releaseDate,
        onSelected: (date) => setState(() => _releaseDate = date),
      ),
      PrivacyType.community => _CommunityPickerEditor(
        communityId: _communityId,
        onSelected: (id) => setState(() => _communityId = id),
      ),
      _ => const SizedBox.shrink(),
    };
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    // Validate privacy options
    if (_privacy == PrivacyType.tagged && _taggedUserIds.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Add at least one tagged user.')));
      return;
    }
    if (_privacy == PrivacyType.timeRelease && _releaseDate == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Choose a release date.')));
      return;
    }
    if (_privacy == PrivacyType.community && _communityId == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Choose a community.')));
      return;
    }

    await context.read<MemoryRepository>().updateTextAndPrivacy(
      memoryId: widget.memory.id,
      textContent: _textController.text.trim(),
      privacy: _privacy,
      taggedUserIds: _taggedUserIds,
      releaseDate: _releaseDate,
      communityId: _communityId,
    );

    if (mounted) {
      Navigator.of(context).pop();
    }
  }
}

class _TaggedUserEditor extends StatefulWidget {
  const _TaggedUserEditor({
    required this.taggedUserIds,
    required this.controller,
    required this.onAdd,
    required this.onRemove,
  });

  final List<String> taggedUserIds;
  final TextEditingController controller;
  final ValueChanged<String> onAdd;
  final ValueChanged<String> onRemove;

  @override
  State<_TaggedUserEditor> createState() => _TaggedUserEditorState();
}

class _TaggedUserEditorState extends State<_TaggedUserEditor> {
  Future<List<AppUser>>? _search;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextFormField(
          key: const ValueKey('editTaggedUsersField'),
          controller: widget.controller,
          onChanged: (value) {
            setState(() {
              _search = context.read<AppUserRepository>().searchUsers(value);
            });
          },
          onFieldSubmitted: (value) {
            widget.onAdd(value);
            setState(() => _search = null);
          },
          decoration: InputDecoration(
            labelText: 'Search tagged users',
            prefixIcon: const Icon(Icons.alternate_email),
            suffixIcon: IconButton(
              tooltip: 'Add typed user ID',
              onPressed: () {
                widget.onAdd(widget.controller.text);
                setState(() => _search = null);
              },
              icon: const Icon(Icons.add),
            ),
          ),
        ),
        if (widget.taggedUserIds.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final userId in widget.taggedUserIds)
                InputChip(
                  label: Text(userId),
                  onDeleted: () => widget.onRemove(userId),
                ),
            ],
          ),
        ],
        FutureBuilder<List<AppUser>>(
          future: _search,
          builder: (context, snapshot) {
            final users = snapshot.data ?? const <AppUser>[];
            if (users.isEmpty) {
              return const SizedBox.shrink();
            }
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Column(
                children: [
                  for (final user in users)
                    ListTile(
                      key: ValueKey('editTaggedUserResult-${user.id}'),
                      leading: const Icon(Icons.person_outline),
                      title: Text(user.displayName ?? user.id),
                      subtitle: Text(user.email ?? user.id),
                      onTap: () {
                        widget.onAdd(user.id);
                        widget.controller.clear();
                        setState(() => _search = null);
                      },
                    ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _ReleaseDateEditor extends StatelessWidget {
  const _ReleaseDateEditor({
    required this.releaseDate,
    required this.onSelected,
  });

  final DateTime? releaseDate;
  final ValueChanged<DateTime> onSelected;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      key: const ValueKey('editReleaseDateButton'),
      onPressed: () async {
        final now = DateTime.now();
        final selected = await showDatePicker(
          context: context,
          initialDate: now.add(const Duration(days: 1)),
          firstDate: now.add(const Duration(days: 1)),
          lastDate: now.add(const Duration(days: 3650)),
        );
        if (selected != null && context.mounted) {
          onSelected(selected);
        }
      },
      icon: const Icon(Icons.event_outlined),
      label: Text(
        releaseDate == null
            ? 'Choose release date'
            : 'Release on ${releaseDate!.day}/${releaseDate!.month}/${releaseDate!.year}',
      ),
    );
  }
}

class _CommunityPickerEditor extends StatelessWidget {
  const _CommunityPickerEditor({
    required this.communityId,
    required this.onSelected,
  });

  final String? communityId;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final session = context.read<AuthCubit>().state.session;
    if (session == null) {
      return const SizedBox.shrink();
    }

    return StreamBuilder<List<Community>>(
      stream: context.read<CommunityRepository>().watchUserCommunities(
        session.userId,
      ),
      builder: (context, snapshot) {
        final communities = snapshot.data ?? const <Community>[];
        return DropdownButtonFormField<String>(
          key: const ValueKey('editCommunityPicker'),
          initialValue: communityId,
          decoration: const InputDecoration(
            labelText: 'Community',
            prefixIcon: Icon(Icons.groups_outlined),
          ),
          items: [
            for (final community in communities)
              DropdownMenuItem(
                value: community.id,
                child: Text(community.name),
              ),
          ],
          onChanged: communities.isEmpty ? null : onSelected,
        );
      },
    );
  }
}
