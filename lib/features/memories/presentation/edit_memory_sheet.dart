import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/memory_validators.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
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
  late PrivacyType _privacy;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.memory.textContent);
    _privacy = widget.memory.privacy == PrivacyType.private
        ? PrivacyType.private
        : PrivacyType.public;
  }

  @override
  void dispose() {
    _textController.dispose();
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
              ],
              selected: {_privacy},
              onSelectionChanged: (selection) {
                setState(() => _privacy = selection.first);
              },
            ),
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
    );
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    await context.read<MemoryRepository>().updateTextAndPrivacy(
      memoryId: widget.memory.id,
      textContent: _textController.text.trim(),
      privacy: _privacy,
      taggedUserIds: const [],
      releaseDate: null,
      communityId: null,
    );

    if (mounted) {
      Navigator.of(context).pop();
    }
  }
}
