import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/core/media/image_compression_service.dart';
import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/core/media/media_upload_service.dart';
import 'package:echoes/core/media/selected_media.dart';
import 'package:echoes/features/aura/data/lexicon_sentiment_analyzer.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/presentation/add_memory_cubit.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AddMemoryCubit', () {
    test('captures location and creates a memory', () async {
      final memoryRepository = LocalMemoryRepository();
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: memoryRepository,
      );

      await cubit.captureLocation();
      expect(cubit.state.status, AddMemoryStatus.ready);
      expect(cubit.state.location?.latitude, 12.9716);

      await cubit.submit(
        userId: 'user-1',
        textContent: 'The courtyard was glowing after the farewell.',
      );

      expect(cubit.state.status, AddMemoryStatus.success);

      final memories = await memoryRepository
          .watchMemoriesForUser('user-1')
          .first;
      expect(memories, hasLength(1));
      expect(memories.single.textContent, contains('courtyard'));
      await cubit.close();
      memoryRepository.dispose();
    });

    test('fails submit when location has not been captured', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
      );

      await cubit.submit(userId: 'user-1', textContent: 'No place yet');

      expect(cubit.state.status, AddMemoryStatus.failure);
      expect(cubit.state.errorMessage, 'Capture location before saving.');
      await cubit.close();
    });

    test('stores selected gallery image path', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(
          galleryPath: '/tmp/memory.jpg',
        ),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
      );

      await cubit.pickFromGallery();

      expect(cubit.state.imagePath, '/tmp/memory.jpg');
      await cubit.close();
    });

    test('stores selected camera image path', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(
          cameraPath: '/tmp/camera-memory.jpg',
        ),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
      );

      await cubit.pickFromCamera();

      expect(cubit.state.imagePath, '/tmp/camera-memory.jpg');
      await cubit.close();
    });

    test('uploads selected image before storing memory URL', () async {
      final memoryRepository = LocalMemoryRepository();
      final uploadService = _FakeMediaUploadService(
        uploadedUrl: 'https://cdn.example.com/memory.jpg',
      );
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(
          galleryPath: '/tmp/memory.jpg',
        ),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: uploadService,
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: memoryRepository,
      );

      await cubit.pickFromGallery();
      await cubit.captureLocation();
      await cubit.submit(userId: 'user-1', textContent: 'Photo memory');

      final memories = await memoryRepository
          .watchMemoriesForUser('user-1')
          .first;

      expect(uploadService.uploadedImagePaths, ['/tmp/memory.jpg']);
      expect(memories.single.imageUrl, 'https://cdn.example.com/memory.jpg');
      await cubit.close();
      memoryRepository.dispose();
    });

    test('uses provided default privacy as initial privacy', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
        initialPrivacy: PrivacyType.private,
      );

      expect(cubit.state.privacy, PrivacyType.private);
      await cubit.close();
    });

    test('requires tagged users for tagged memories', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
      )..setPrivacy(PrivacyType.tagged);

      await cubit.captureLocation();
      await cubit.submit(userId: 'user-1', textContent: 'Tagged memory');

      expect(cubit.state.status, AddMemoryStatus.failure);
      expect(cubit.state.errorMessage, 'Add at least one tagged user.');
      await cubit.close();
    });

    test('requires future release date for time-release memories', () async {
      final cubit = AddMemoryCubit(
        locationService: _FakeLocationService(
          permission: LocationPermissionState.granted,
        ),
        mediaPickerService: _FakeMediaPickerService(),
        imageCompressionService: _NoOpImageCompressionService(),
        mediaUploadService: _FakeMediaUploadService(),
        sentimentAnalyzer: LexiconSentimentAnalyzer(),
        placeRepository: LocalPlaceRepository(now: DateTime.utc(2026, 5, 14)),
        memoryRepository: LocalMemoryRepository(),
      )..setPrivacy(PrivacyType.timeRelease);

      await cubit.captureLocation();
      await cubit.submit(userId: 'user-1', textContent: 'Later memory');

      expect(cubit.state.status, AddMemoryStatus.failure);
      expect(cubit.state.errorMessage, 'Choose a release date.');
      await cubit.close();
    });

    test(
      'creates community-scoped memory when community is selected',
      () async {
        final memoryRepository = LocalMemoryRepository();
        final cubit =
            AddMemoryCubit(
                locationService: _FakeLocationService(
                  permission: LocationPermissionState.granted,
                ),
                mediaPickerService: _FakeMediaPickerService(),
                imageCompressionService: _NoOpImageCompressionService(),
                mediaUploadService: _FakeMediaUploadService(),
                sentimentAnalyzer: LexiconSentimentAnalyzer(),
                placeRepository: LocalPlaceRepository(
                  now: DateTime.utc(2026, 5, 14),
                ),
                memoryRepository: memoryRepository,
              )
              ..setPrivacy(PrivacyType.community)
              ..setCommunity('campus-keepers');

        await cubit.captureLocation();
        await cubit.submit(userId: 'user-1', textContent: 'Community memory');

        final memories = await memoryRepository
            .watchMemoriesForUser('user-1')
            .first;

        expect(cubit.state.status, AddMemoryStatus.success);
        expect(memories.single.privacy, PrivacyType.community);
        expect(memories.single.communityId, 'campus-keepers');
        await cubit.close();
        memoryRepository.dispose();
      },
    );
  });
}

class _FakeLocationService implements LocationService {
  _FakeLocationService({required this.permission});

  LocationPermissionState permission;

  @override
  Future<LocationPermissionState> checkPermission() async => permission;

  @override
  Future<DeviceLocation> getCurrentLocation() async {
    return const DeviceLocation(
      latitude: 12.9716,
      longitude: 77.5946,
      accuracyMeters: 8,
    );
  }

  @override
  Future<LocationPermissionState> requestPermission() async => permission;
}

class _FakeMediaPickerService implements MediaPickerService {
  _FakeMediaPickerService({this.cameraPath, this.galleryPath});

  final String? cameraPath;
  final String? galleryPath;

  @override
  Future<SelectedMedia?> pickFromCamera() async {
    return cameraPath == null ? null : SelectedMedia(path: cameraPath!);
  }

  @override
  Future<SelectedMedia?> pickFromGallery() async {
    return galleryPath == null ? null : SelectedMedia(path: galleryPath!);
  }
}

class _NoOpImageCompressionService implements ImageCompressionService {
  @override
  Future<String> compressToUploadLimit(String imagePath) async => imagePath;
}

class _FakeMediaUploadService implements MediaUploadService {
  _FakeMediaUploadService({this.uploadedUrl});

  final String? uploadedUrl;
  final List<String> uploadedImagePaths = [];

  @override
  Future<String?> uploadMemoryImage({
    required String userId,
    required String imagePath,
    required String memoryId,
  }) async {
    uploadedImagePaths.add(imagePath);
    return uploadedUrl ?? imagePath;
  }
}
