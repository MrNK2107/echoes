import 'package:echoes/app/theme.dart';
import 'package:echoes/features/home/presentation/echoes_home_shell.dart';
import 'package:flutter/material.dart';

class EchoesApp extends StatelessWidget {
  const EchoesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ECHOES',
      debugShowCheckedModeBanner: false,
      theme: EchoesTheme.dark,
      home: const EchoesHomeShell(),
    );
  }
}
