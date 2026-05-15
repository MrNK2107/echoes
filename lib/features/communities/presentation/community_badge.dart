import 'package:echoes/app/theme.dart';
import 'package:echoes/features/communities/domain/community.dart';
import 'package:echoes/features/communities/domain/community_type.dart';
import 'package:flutter/material.dart';

class CommunityBadge extends StatelessWidget {
  const CommunityBadge({required this.community, super.key});

  final Community community;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${community.name} community badge',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: EchoesColors.elevatedSurface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: EchoesColors.surface),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(_iconFor(community.type), size: 16),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  community.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: EchoesColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _iconFor(CommunityType type) {
    return switch (type) {
      CommunityType.geographic => Icons.place_outlined,
      CommunityType.thematic => Icons.auto_awesome_outlined,
      CommunityType.timeBased => Icons.history_outlined,
      CommunityType.institution => Icons.account_balance_outlined,
    };
  }
}
