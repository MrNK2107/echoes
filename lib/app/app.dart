import 'package:echoes/app/theme.dart';
import 'package:echoes/core/location/geolocator_location_service.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/core/media/image_picker_media_service.dart';
import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/features/ar/data/local_ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/aura/data/lexicon_sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_gate.dart';
import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/legacy/data/local_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class EchoesApp extends StatelessWidget {
  const EchoesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ECHOES',
      debugShowCheckedModeBanner: false,
      theme: EchoesTheme.dark,
      home: MultiRepositoryProvider(
        providers: [
          RepositoryProvider<AuthRepository>(
            create: (_) => LocalAuthRepository(),
          ),
          RepositoryProvider<LocationService>(
            create: (_) => GeolocatorLocationService(),
          ),
          RepositoryProvider<MediaPickerService>(
            create: (_) => ImagePickerMediaService(),
          ),
          RepositoryProvider<SentimentAnalyzer>(
            create: (_) => LexiconSentimentAnalyzer(),
          ),
          RepositoryProvider<ArAvailabilityService>(
            create: (_) => const LocalArAvailabilityService(),
          ),
          RepositoryProvider<PlaceRepository>(
            create: (_) => LocalPlaceRepository(),
          ),
          RepositoryProvider<MemoryRepository>(
            create: (_) => LocalMemoryRepository(),
          ),
          RepositoryProvider<CommunityRepository>(
            create: (_) => LocalCommunityRepository(),
          ),
          RepositoryProvider<LegacyTransferRepository>(
            create: (_) => LocalLegacyTransferRepository(),
          ),
        ],
        child: BlocProvider(
          create: (context) =>
              AuthCubit(repository: context.read<AuthRepository>())..start(),
          child: const AuthGate(),
        ),
      ),
    );
  }
}
