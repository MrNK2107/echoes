import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/core/media/image_compression_service.dart';
import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/core/media/selected_media.dart';
import 'package:echoes/features/aura/data/lexicon_sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/add_memory_placeholder_screen.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/users/data/local_app_user_repository.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AddMemoryPlaceholderScreen', () {
    testWidgets('renders form controls and validates required memory text', (
      tester,
    ) async {
      await tester.pumpWidget(const _TestApp());
      await tester.pumpAndSettle();

      expect(find.text('Capture a memory.'), findsOneWidget);
      expect(find.byKey(const ValueKey('memoryTextField')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('memoryPrivacySelector')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('capturePhotoButton')), findsOneWidget);
      expect(
        find.byKey(const ValueKey('pickGalleryPhotoButton')),
        findsOneWidget,
      );

      await tester.ensureVisible(
        find.byKey(const ValueKey('saveMemoryButton')),
      );
      await tester.tap(find.byKey(const ValueKey('saveMemoryButton')));
      await tester.pumpAndSettle();

      expect(find.text('Memory text is required'), findsOneWidget);
    });

    testWidgets('shows tagged user input when tagged privacy is selected', (
      tester,
    ) async {
      await tester.pumpWidget(const _TestApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Tagged'));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('taggedUsersField')), findsOneWidget);
    });
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp();

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<AuthRepository>(
          create: (_) => LocalAuthRepository(),
        ),
        RepositoryProvider<AppUserRepository>(
          create: (_) => LocalAppUserRepository(),
        ),
        RepositoryProvider<LocationService>(
          create: (_) => const _FakeLocationService(),
        ),
        RepositoryProvider<MediaPickerService>(
          create: (_) => const _FakeMediaPickerService(),
        ),
        RepositoryProvider<ImageCompressionService>(
          create: (_) => const _NoOpImageCompressionService(),
        ),
        RepositoryProvider<SentimentAnalyzer>(
          create: (_) => LexiconSentimentAnalyzer(),
        ),
        RepositoryProvider<PlaceRepository>(
          create: (_) => LocalPlaceRepository(now: DateTime.utc(2026, 5, 15)),
        ),
        RepositoryProvider<MemoryRepository>(
          create: (_) => LocalMemoryRepository(),
        ),
        RepositoryProvider<CommunityRepository>(
          create: (_) => LocalCommunityRepository(),
        ),
      ],
      child: BlocProvider(
        create: (context) => AuthCubit(
          repository: context.read<AuthRepository>(),
          userRepository: context.read<AppUserRepository>(),
        )..start(),
        child: const MaterialApp(
          home: Scaffold(body: AddMemoryPlaceholderScreen()),
        ),
      ),
    );
  }
}

class _FakeLocationService implements LocationService {
  const _FakeLocationService();

  @override
  Future<LocationPermissionState> checkPermission() async {
    return LocationPermissionState.granted;
  }

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    return const DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 8,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async {
    return LocationPermissionState.granted;
  }
}

class _FakeMediaPickerService implements MediaPickerService {
  const _FakeMediaPickerService();

  @override
  Future<SelectedMedia?> pickFromCamera() async {
    return const SelectedMedia(path: '/tmp/camera.jpg');
  }

  @override
  Future<SelectedMedia?> pickFromGallery() async {
    return const SelectedMedia(path: '/tmp/gallery.jpg');
  }
}

class _NoOpImageCompressionService implements ImageCompressionService {
  const _NoOpImageCompressionService();

  @override
  Future<String> compressToUploadLimit(String imagePath) async => imagePath;
}
