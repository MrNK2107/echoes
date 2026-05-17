import 'package:echoes/features/ar/presentation/ar_placeholder_screen.dart';
import 'package:echoes/features/communities/presentation/communities_placeholder_screen.dart';
import 'package:echoes/features/map/presentation/map_placeholder_screen.dart';
import 'package:echoes/features/memories/presentation/add_memory_placeholder_screen.dart';
import 'package:echoes/features/profile/presentation/profile_placeholder_screen.dart';
import 'package:flutter/material.dart';

class HomeDestination {
  const HomeDestination({
    required this.label,
    required this.semanticLabel,
    required this.title,
    required this.icon,
    required this.activeIcon,
    required this.screen,
  });

  final String label;
  final String semanticLabel;
  final String title;
  final IconData icon;
  final IconData activeIcon;
  final Widget screen;
}

const homeDestinations = [
  HomeDestination(
    label: 'Map',
    semanticLabel: 'Open map tab',
    title: 'Nearby Echoes',
    icon: Icons.map_outlined,
    activeIcon: Icons.map,
    screen: MapPlaceholderScreen(),
  ),
  HomeDestination(
    label: 'AR',
    semanticLabel: 'Open AR tab',
    title: 'Aura View',
    icon: Icons.view_in_ar_outlined,
    activeIcon: Icons.view_in_ar,
    screen: ArPlaceholderScreen(),
  ),
  HomeDestination(
    label: 'Add',
    semanticLabel: 'Open add memory tab',
    title: 'Add Memory',
    icon: Icons.add_circle_outline,
    activeIcon: Icons.add_circle,
    screen: AddMemoryPlaceholderScreen(),
  ),
  HomeDestination(
    label: 'Communities',
    semanticLabel: 'Open communities tab',
    title: 'Communities',
    icon: Icons.groups_outlined,
    activeIcon: Icons.groups,
    screen: CommunitiesPlaceholderScreen(),
  ),
  HomeDestination(
    label: 'Profile',
    semanticLabel: 'Open profile tab',
    title: 'Profile',
    icon: Icons.person_outline,
    activeIcon: Icons.person,
    screen: ProfilePlaceholderScreen(),
  ),
];
