import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/core/media/image_compression_service.dart';
import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/core/media/media_upload_service.dart';
import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/add_memory_cubit.dart';
import 'package:echoes/features/memories/presentation/add_memory_state.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/memories/presentation/memory_validators.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:echoes/features/users/domain/app_user.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AddMemoryPlaceholderScreen extends StatelessWidget {
  const AddMemoryPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: context.read<AppUserRepository>().watchCurrentUser(),
      builder: (context, snapshot) {
        return BlocProvider(
          key: ValueKey(snapshot.data?.defaultPrivacy),
          create: (context) => AddMemoryCubit(
            locationService: context.read<LocationService>(),
            mediaPickerService: context.read<MediaPickerService>(),
            imageCompressionService: context.read<ImageCompressionService>(),
            mediaUploadService: context.read<MediaUploadService>(),
            sentimentAnalyzer: context.read<SentimentAnalyzer>(),
            placeRepository: context.read<PlaceRepository>(),
            memoryRepository: context.read<MemoryRepository>(),
            initialPrivacy: snapshot.data?.defaultPrivacy ?? PrivacyType.public,
          ),
          child: const _AddMemoryView(),
        );
      },
    );
  }
}

class _AddMemoryView extends StatefulWidget {
  const _AddMemoryView();

  @override
  State<_AddMemoryView> createState() => _AddMemoryViewState();
}

class _AddMemoryViewState extends State<_AddMemoryView> {
  final _formKey = GlobalKey<FormState>();
  final _textController = TextEditingController();

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<AddMemoryCubit, AddMemoryState>(
      listener: (context, state) {
        if (state.status == AddMemoryStatus.failure &&
            state.errorMessage != null) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
        }
        if (state.status == AddMemoryStatus.success) {
          _textController.clear();
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(const SnackBar(content: Text('Memory saved')));
        }
      },
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Capture a memory.',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: EchoesColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Add text, privacy, and the current GPS point. Photos and audio come next.',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: EchoesColors.textSecondary,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 24),
                const _PhotoSelector(),
                const SizedBox(height: 16),
                TextFormField(
                  key: const ValueKey('memoryTextField'),
                  controller: _textController,
                  minLines: 5,
                  maxLines: 8,
                  maxLength: 2000,
                  validator: MemoryValidators.text,
                  decoration: const InputDecoration(
                    labelText: 'Memory',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 16),
                const _PrivacySelector(),
                const _PrivacyOptions(),
                const SizedBox(height: 16),
                const _LocationCapture(),
                const SizedBox(height: 16),
                _MemoryPreview(textController: _textController),
                const SizedBox(height: 24),
                BlocBuilder<AddMemoryCubit, AddMemoryState>(
                  builder: (context, state) {
                    final isSubmitting =
                        state.status == AddMemoryStatus.submitting;

                    return FilledButton.icon(
                      key: const ValueKey('saveMemoryButton'),
                      onPressed: isSubmitting ? null : _submit,
                      icon: isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label: const Text('Save memory'),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    final session = context.read<AuthCubit>().state.session;
    if (session == null) {
      return;
    }

    context.read<AddMemoryCubit>().submit(
      userId: session.userId,
      textContent: _textController.text,
    );
  }
}

class _PhotoSelector extends StatelessWidget {
  const _PhotoSelector();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AddMemoryCubit, AddMemoryState>(
      builder: (context, state) {
        return DecoratedBox(
          decoration: BoxDecoration(
            color: EchoesColors.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: EchoesColors.elevatedSurface),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  state.imagePath == null
                      ? 'No photo selected'
                      : 'Photo selected',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: EchoesColors.textPrimary,
                  ),
                ),
                if (state.imagePath != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    state.imagePath!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: EchoesColors.textSecondary,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('capturePhotoButton'),
                        onPressed: () =>
                            context.read<AddMemoryCubit>().pickFromCamera(),
                        icon: const Icon(Icons.photo_camera_outlined),
                        label: const Text('Camera'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('pickGalleryPhotoButton'),
                        onPressed: () =>
                            context.read<AddMemoryCubit>().pickFromGallery(),
                        icon: const Icon(Icons.photo_library_outlined),
                        label: const Text('Gallery'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PrivacySelector extends StatelessWidget {
  const _PrivacySelector();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AddMemoryCubit, AddMemoryState>(
      builder: (context, state) {
        return SegmentedButton<PrivacyType>(
          key: const ValueKey('memoryPrivacySelector'),
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
          selected: {state.privacy},
          onSelectionChanged: (selection) {
            context.read<AddMemoryCubit>().setPrivacy(selection.first);
          },
        );
      },
    );
  }
}

class _PrivacyOptions extends StatelessWidget {
  const _PrivacyOptions();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AddMemoryCubit, AddMemoryState>(
      builder: (context, state) {
        return switch (state.privacy) {
          PrivacyType.tagged => const _TaggedUserInput(),
          PrivacyType.timeRelease => const _ReleaseDateInput(),
          PrivacyType.community => const _CommunityPicker(),
          _ => const SizedBox.shrink(),
        };
      },
    );
  }
}

class _TaggedUserInput extends StatefulWidget {
  const _TaggedUserInput();

  @override
  State<_TaggedUserInput> createState() => _TaggedUserInputState();
}

class _TaggedUserInputState extends State<_TaggedUserInput> {
  final _controller = TextEditingController();
  Future<List<AppUser>>? _search;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: BlocBuilder<AddMemoryCubit, AddMemoryState>(
        builder: (context, state) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                key: const ValueKey('taggedUsersField'),
                controller: _controller,
                onChanged: (value) {
                  setState(() {
                    _search = context.read<AppUserRepository>().searchUsers(
                      value,
                    );
                  });
                },
                onFieldSubmitted: (value) {
                  context.read<AddMemoryCubit>().addTaggedUser(value);
                  _controller.clear();
                  setState(() => _search = null);
                },
                decoration: InputDecoration(
                  labelText: 'Search tagged users',
                  helperText: 'Tap a result, or submit a user ID directly',
                  prefixIcon: const Icon(Icons.alternate_email),
                  suffixIcon: IconButton(
                    tooltip: 'Add typed user ID',
                    onPressed: () {
                      context.read<AddMemoryCubit>().addTaggedUser(
                        _controller.text,
                      );
                      _controller.clear();
                      setState(() => _search = null);
                    },
                    icon: const Icon(Icons.add),
                  ),
                ),
              ),
              if (state.taggedUserIds.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final userId in state.taggedUserIds)
                      InputChip(
                        label: Text(userId),
                        onDeleted: () => context
                            .read<AddMemoryCubit>()
                            .removeTaggedUser(userId),
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
                            key: ValueKey('taggedUserResult-${user.id}'),
                            leading: const Icon(Icons.person_outline),
                            title: Text(user.displayName ?? user.id),
                            subtitle: Text(user.email ?? user.id),
                            onTap: () {
                              context.read<AddMemoryCubit>().addTaggedUser(
                                user.id,
                              );
                              _controller.clear();
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
        },
      ),
    );
  }
}

class _ReleaseDateInput extends StatelessWidget {
  const _ReleaseDateInput();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AddMemoryCubit, AddMemoryState>(
      builder: (context, state) {
        final releaseDate = state.releaseDate;

        return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: OutlinedButton.icon(
            key: const ValueKey('releaseDateButton'),
            onPressed: () async {
              final now = DateTime.now();
              final selected = await showDatePicker(
                context: context,
                initialDate: now.add(const Duration(days: 1)),
                firstDate: now.add(const Duration(days: 1)),
                lastDate: now.add(const Duration(days: 3650)),
              );
              if (selected != null && context.mounted) {
                context.read<AddMemoryCubit>().setReleaseDate(selected);
              }
            },
            icon: const Icon(Icons.event_outlined),
            label: Text(
              releaseDate == null
                  ? 'Choose release date'
                  : 'Release on ${releaseDate.day}/${releaseDate.month}/${releaseDate.year}',
            ),
          ),
        );
      },
    );
  }
}

class _CommunityPicker extends StatelessWidget {
  const _CommunityPicker();

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

        return Padding(
          padding: const EdgeInsets.only(top: 12),
          child: DropdownButtonFormField<String>(
            key: const ValueKey('communityPicker'),
            initialValue: context.watch<AddMemoryCubit>().state.communityId,
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
            onChanged: communities.isEmpty
                ? null
                : context.read<AddMemoryCubit>().setCommunity,
          ),
        );
      },
    );
  }
}

class _LocationCapture extends StatelessWidget {
  const _LocationCapture();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AddMemoryCubit, AddMemoryState>(
      builder: (context, state) {
        final location = state.location;

        return DecoratedBox(
          decoration: BoxDecoration(
            color: EchoesColors.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: EchoesColors.elevatedSurface),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  location == null
                      ? 'No location captured'
                      : 'Location: ${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: EchoesColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  key: const ValueKey('captureMemoryLocationButton'),
                  onPressed: state.status == AddMemoryStatus.locating
                      ? null
                      : () => context.read<AddMemoryCubit>().captureLocation(),
                  icon: const Icon(Icons.my_location),
                  label: Text(
                    state.status == AddMemoryStatus.locating
                        ? 'Capturing...'
                        : 'Capture current location',
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MemoryPreview extends StatefulWidget {
  const _MemoryPreview({required this.textController});

  final TextEditingController textController;

  @override
  State<_MemoryPreview> createState() => _MemoryPreviewState();
}

class _MemoryPreviewState extends State<_MemoryPreview> {
  @override
  void initState() {
    super.initState();
    widget.textController.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.textController.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AddMemoryCubit, AddMemoryState>(
      builder: (context, state) {
        final text = widget.textController.text.trim();

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
                  'Preview',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: EchoesColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  text.isEmpty ? 'Your memory text will appear here.' : text,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: EchoesColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  state.privacy == PrivacyType.public ? 'Public' : 'Private',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: EchoesColors.sunsetGold,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
