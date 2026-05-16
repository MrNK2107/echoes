import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';

class NotificationSettings extends StatefulWidget {
  const NotificationSettings({super.key});

  @override
  State<NotificationSettings> createState() => _NotificationSettingsState();
}

class _NotificationSettingsState extends State<NotificationSettings> {
  bool _transferAlerts = true;
  bool _tagAlerts = true;
  bool _communityAlerts = false;

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
