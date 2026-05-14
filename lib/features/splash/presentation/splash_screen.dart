import 'package:echoes/app/theme.dart';
import 'package:flutter/material.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text(
          'ECHOES',
          style: TextStyle(
            color: EchoesColors.textPrimary,
            fontSize: 32,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}
