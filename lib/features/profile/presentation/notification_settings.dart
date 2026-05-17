import 'package:echoes/app/theme.dart';
import 'package:echoes/features/notifications/domain/notification_permission_service.dart';
import 'package:echoes/features/notifications/domain/notification_permission_status.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class NotificationSettings extends StatefulWidget {
  const NotificationSettings({super.key});

  @override
  State<NotificationSettings> createState() => _NotificationSettingsState();
}

class _NotificationSettingsState extends State<NotificationSettings> {
  bool _transferAlerts = true;
  bool _tagAlerts = true;
  bool _communityAlerts = false;
  NotificationPermissionStatus _permissionStatus =
      NotificationPermissionStatus.unknown;

  @override
  void initState() {
    super.initState();
    _loadPermissionStatus();
  }

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
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Notifications',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: EchoesColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            _NotificationPermissionBanner(
              status: _permissionStatus,
              onRequest: _requestPermission,
            ),
            const SizedBox(height: 8),
            _NotificationToggle(
              tileKey: const ValueKey('transferNotificationToggle'),
              icon: Icons.swap_horiz,
              title: 'Custodianship requests',
              value: _transferAlerts,
              onChanged: (value) => setState(() => _transferAlerts = value),
            ),
            _NotificationToggle(
              tileKey: const ValueKey('tagNotificationToggle'),
              icon: Icons.alternate_email,
              title: 'Tagged memories',
              value: _tagAlerts,
              onChanged: (value) => setState(() => _tagAlerts = value),
            ),
            _NotificationToggle(
              tileKey: const ValueKey('communityNotificationToggle'),
              icon: Icons.groups_outlined,
              title: 'Community invitations',
              value: _communityAlerts,
              onChanged: (value) => setState(() => _communityAlerts = value),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadPermissionStatus() async {
    final status = await context
        .read<NotificationPermissionService>()
        .checkPermission();
    if (mounted) {
      setState(() => _permissionStatus = status);
    }
  }

  Future<void> _requestPermission() async {
    final status = await context
        .read<NotificationPermissionService>()
        .requestPermission();
    if (mounted) {
      setState(() => _permissionStatus = status);
    }
  }
}

class _NotificationPermissionBanner extends StatelessWidget {
  const _NotificationPermissionBanner({
    required this.status,
    required this.onRequest,
  });

  final NotificationPermissionStatus status;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    if (status.isGranted) {
      return Text(
        'Notification permission enabled',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: EchoesColors.textSecondary),
      );
    }

    final isBlocked = status == NotificationPermissionStatus.permanentlyDenied;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EchoesColors.elevatedSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: EchoesColors.surface),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.notifications_active_outlined),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                isBlocked
                    ? 'Notifications are blocked in system settings.'
                    : 'Enable notifications for transfers, tags, and invites.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: EchoesColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 12),
            TextButton(
              key: const ValueKey('requestNotificationPermissionButton'),
              onPressed: isBlocked ? null : onRequest,
              child: const Text('Enable'),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationToggle extends StatelessWidget {
  const _NotificationToggle({
    required this.tileKey,
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final Key tileKey;
  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      key: tileKey,
      contentPadding: EdgeInsets.zero,
      secondary: Icon(icon, color: EchoesColors.celestialBlue),
      title: Text(title),
      value: value,
      onChanged: onChanged,
    );
  }
}
