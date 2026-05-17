import 'package:echoes/features/home/presentation/home_destination.dart';
import 'package:flutter/material.dart';

class EchoesHomeShell extends StatefulWidget {
  const EchoesHomeShell({super.key});

  @override
  State<EchoesHomeShell> createState() => _EchoesHomeShellState();
}

class _EchoesHomeShellState extends State<EchoesHomeShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final destination = homeDestinations[_selectedIndex];

    return Scaffold(
      appBar: AppBar(title: Text(destination.title)),
      body: destination.screen,
      bottomNavigationBar: Semantics(
        label: 'Primary app navigation',
        child: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) => setState(() => _selectedIndex = index),
          items: [
            for (final destination in homeDestinations)
              BottomNavigationBarItem(
                icon: Icon(
                  destination.icon,
                  semanticLabel: destination.semanticLabel,
                ),
                activeIcon: Icon(
                  destination.activeIcon,
                  semanticLabel: destination.semanticLabel,
                ),
                label: destination.label,
                tooltip: destination.semanticLabel,
              ),
          ],
        ),
      ),
    );
  }
}
