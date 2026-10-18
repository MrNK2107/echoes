import 'package:echoes/app/theme.dart';
import 'package:echoes/features/institutions/application/institution_admin_service.dart';
import 'package:echoes/features/institutions/domain/campus_sub_zone.dart';
import 'package:echoes/features/institutions/domain/institution_repository.dart';
import 'package:echoes/features/institutions/domain/institution_zone.dart';
import 'package:echoes/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

class InstitutionDetailScreen extends StatefulWidget {
  const InstitutionDetailScreen({
    required this.zone,
    required this.userId,
    super.key,
  });

  final InstitutionZone zone;
  final String userId;

  @override
  State<InstitutionDetailScreen> createState() =>
      _InstitutionDetailScreenState();
}

class _InstitutionDetailScreenState extends State<InstitutionDetailScreen> {
  late InstitutionZone _zone;
  final _service = const InstitutionAdminService();
  final _emailController = TextEditingController();
  String? _verificationError;

  @override
  void initState() {
    super.initState();
    _zone = widget.zone;
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  bool get _isAdmin => _zone.verifiedAdminUserIds.contains(widget.userId);

  Future<void> _verifyAdmin() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) return;

    setState(() => _verificationError = null);
    try {
      final updated = _service.verifyAdmin(
        institution: _zone,
        userId: widget.userId,
        email: email,
      );
      await context.read<InstitutionRepository>().save(updated);
      setState(() {
        _zone = updated;
        _emailController.clear();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verified as admin!')),
        );
      }
    } on InstitutionVerificationException catch (e) {
      setState(() => _verificationError = e.message);
    }
  }

  Future<void> _addSubZone() async {
    final nameController = TextEditingController();
    final latController = TextEditingController();
    final lonController = TextEditingController();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Add sub-zone'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: latController,
              decoration: const InputDecoration(labelText: 'Latitude'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: lonController,
              decoration: const InputDecoration(labelText: 'Longitude'),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop({
              'name': nameController.text.trim(),
              'lat': latController.text.trim(),
              'lon': lonController.text.trim(),
            }),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (result == null || !mounted) return;

    try {
      final latitude = double.parse(result['lat']!);
      final longitude = double.parse(result['lon']!);
      final subZone = CampusSubZone(
        id: const Uuid().v4(),
        name: result['name']!,
        latitude: latitude,
        longitude: longitude,
        radiusMeters: 60,
      );
      final updated = _service.addSubZone(
        institution: _zone,
        adminUserId: widget.userId,
        subZone: subZone,
      );
      await context.read<InstitutionRepository>().save(updated);
      setState(() => _zone = updated);
    } on FormatException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Invalid coordinates')),
        );
      }
    } on InstitutionVerificationException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_zone.name)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${_zone.allowedEmailDomains.length} approved domain(s)',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: EchoesColors.textSecondary,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _zone.allowedEmailDomains.map((domain) {
                  return Chip(
                    label: Text(domain, style: const TextStyle(fontSize: 12)),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),

              // Admin verification
              Text(
                'Admin verification',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              if (_isAdmin)
                const ListTile(
                  leading: Icon(Icons.verified, color: EchoesColors.celestialBlue),
                  title: Text('You are verified as admin'),
                  contentPadding: EdgeInsets.zero,
                )
              else ...[
                TextField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: 'Institutional email',
                    errorText: _verificationError,
                    helperText:
                        'Use your ${_zone.allowedEmailDomains.first} email',
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: _verifyAdmin,
                  icon: const Icon(Icons.verified_outlined),
                  label: const Text('Verify as admin'),
                ),
              ],
              const SizedBox(height: 24),

              // Sub-zones
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Sub-zones',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (_isAdmin)
                    IconButton.filledTonal(
                      onPressed: _addSubZone,
                      icon: const Icon(Icons.add, size: 20),
                      tooltip: 'Add sub-zone',
                    ),
                ],
              ),
              const SizedBox(height: 8),
              if (_zone.subZones.isEmpty)
                const EmptyState(
                  icon: Icons.map_outlined,
                  title: 'No sub-zones yet.',
                  description:
                      'Verified admins can add campus buildings and areas.',
                )
              else
                ..._zone.subZones.map((subZone) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      child: ListTile(
                        leading: const Icon(Icons.location_on_outlined),
                        title: Text(subZone.name),
                        subtitle: Text(
                          '${subZone.latitude.toStringAsFixed(4)}, ${subZone.longitude.toStringAsFixed(4)} · ${subZone.radiusMeters}m radius',
                        ),
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
