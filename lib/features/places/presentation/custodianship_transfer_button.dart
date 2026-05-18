import 'package:echoes/features/legacy/application/custodianship_transfer_service.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer.dart';
import 'package:echoes/features/legacy/domain/transfer_status.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

class CustodianshipTransferButton extends StatelessWidget {
  const CustodianshipTransferButton({
    required this.place,
    required this.currentUserId,
    super.key,
  });

  final Place place;
  final String currentUserId;

  @override
  Widget build(BuildContext context) {
    if (!place.custodianIds.contains(currentUserId)) {
      return const SizedBox.shrink();
    }

    return OutlinedButton.icon(
      key: const ValueKey('initiateTransferButton'),
      onPressed: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) =>
            _TransferSheet(place: place, currentUserId: currentUserId),
      ),
      icon: const Icon(Icons.swap_horiz),
      label: const Text('Transfer custodianship'),
    );
  }
}

class _TransferSheet extends StatefulWidget {
  const _TransferSheet({required this.place, required this.currentUserId});

  final Place place;
  final String currentUserId;

  @override
  State<_TransferSheet> createState() => _TransferSheetState();
}

class _TransferSheetState extends State<_TransferSheet> {
  final _formKey = GlobalKey<FormState>();
  final _recipientController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _recipientController.dispose();
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
              'Transfer custodianship',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const ValueKey('transferRecipientField'),
              controller: _recipientController,
              decoration: const InputDecoration(
                labelText: 'Recipient user ID',
                prefixIcon: Icon(Icons.person_add_alt_1_outlined),
              ),
              validator: (value) {
                final recipientId = value?.trim() ?? '';
                if (recipientId.isEmpty) {
                  return 'Recipient user ID is required';
                }
                if (recipientId == widget.currentUserId) {
                  return 'Choose another user';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              key: const ValueKey('sendTransferButton'),
              onPressed: _isSubmitting ? null : _submit,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined),
              label: const Text('Send transfer'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    setState(() => _isSubmitting = true);
    final now = DateTime.now().toUtc();
    await context.read<CustodianshipTransferService>().initiateTransfer(
      LegacyTransfer(
        id: const Uuid().v4(),
        placeId: widget.place.id,
        fromUserId: widget.currentUserId,
        toUserId: _recipientController.text.trim(),
        status: TransferStatus.pending,
        createdAt: now,
        revokeUntil: now.add(const Duration(days: 7)),
      ),
    );

    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Custodianship transfer sent')),
      );
    }
  }
}
