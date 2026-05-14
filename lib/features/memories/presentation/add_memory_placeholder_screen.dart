import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/add_memory_cubit.dart';
import 'package:echoes/features/memories/presentation/add_memory_state.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/memories/presentation/memory_validators.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class AddMemoryPlaceholderScreen extends StatelessWidget {
  const AddMemoryPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => AddMemoryCubit(
        locationService: context.read<LocationService>(),
        placeRepository: context.read<PlaceRepository>(),
        memoryRepository: context.read<MemoryRepository>(),
      ),
      child: const _AddMemoryView(),
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
                const SizedBox(height: 16),
                const _LocationCapture(),
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
