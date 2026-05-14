import 'package:echoes/core/geo/geohash.dart';
import 'package:echoes/core/location/location_permission_state.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/core/media/selected_media.dart';
import 'package:echoes/features/aura/domain/aura_calculator.dart';
import 'package:echoes/features/aura/domain/aura_zone.dart';
import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/memories/domain/memory.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/presentation/add_memory_state.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/places/domain/place.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:uuid/uuid.dart';

class AddMemoryCubit extends Cubit<AddMemoryState> {
  AddMemoryCubit({
    required LocationService locationService,
    required MediaPickerService mediaPickerService,
    required SentimentAnalyzer sentimentAnalyzer,
    required PlaceRepository placeRepository,
    required MemoryRepository memoryRepository,
    AuraCalculator? auraCalculator,
    Uuid? uuid,
  }) : _locationService = locationService,
       _mediaPickerService = mediaPickerService,
       _sentimentAnalyzer = sentimentAnalyzer,
       _auraCalculator = auraCalculator ?? AuraCalculator(),
       _placeRepository = placeRepository,
       _memoryRepository = memoryRepository,
       _uuid = uuid ?? const Uuid(),
       super(const AddMemoryState.initial());

  static const placeMatchRadiusMeters = 100.0;

  final LocationService _locationService;
  final MediaPickerService _mediaPickerService;
  final SentimentAnalyzer _sentimentAnalyzer;
  final AuraCalculator _auraCalculator;
  final PlaceRepository _placeRepository;
  final MemoryRepository _memoryRepository;
  final Uuid _uuid;

  void setPrivacy(PrivacyType privacy) {
    emit(state.copyWith(privacy: privacy));
  }

  Future<void> pickFromCamera() async {
    await _pickImage(_mediaPickerService.pickFromCamera);
  }

  Future<void> pickFromGallery() async {
    await _pickImage(_mediaPickerService.pickFromGallery);
  }

  Future<void> _pickImage(Future<SelectedMedia?> Function() pick) async {
    try {
      final media = await pick();
      if (media != null) {
        emit(state.copyWith(imagePath: media.path));
      }
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: AddMemoryStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> captureLocation() async {
    emit(state.copyWith(status: AddMemoryStatus.locating));

    try {
      var permission = await _locationService.checkPermission();
      if (permission == LocationPermissionState.denied ||
          permission == LocationPermissionState.unknown) {
        permission = await _locationService.requestPermission();
      }

      if (!permission.isGranted) {
        emit(
          state.copyWith(
            status: AddMemoryStatus.failure,
            errorMessage: 'Location permission is required to add a memory.',
          ),
        );
        return;
      }

      final location = await _locationService.getCurrentLocation();
      emit(state.copyWith(status: AddMemoryStatus.ready, location: location));
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: AddMemoryStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> submit({
    required String userId,
    required String textContent,
  }) async {
    final location = state.location;
    if (location == null) {
      emit(
        state.copyWith(
          status: AddMemoryStatus.failure,
          errorMessage: 'Capture location before saving.',
        ),
      );
      return;
    }

    emit(state.copyWith(status: AddMemoryStatus.submitting));

    try {
      final now = DateTime.now().toUtc();
      var place = await _placeRepository.findNearestPlace(
        latitude: location.latitude,
        longitude: location.longitude,
        radiusMeters: placeMatchRadiusMeters,
      );

      if (place == null) {
        place = Place(
          id: _uuid.v4(),
          name: 'Memory Place',
          latitude: location.latitude,
          longitude: location.longitude,
          geohash: Geohash.encode(
            latitude: location.latitude,
            longitude: location.longitude,
          ),
          custodianIds: [userId],
          aura: AuraZone.empty(now),
          memoryCount: 0,
          publicMemoryCount: 0,
          createdAt: now,
          updatedAt: now,
        );
        await _placeRepository.create(place);
      }

      final sentiment = _sentimentAnalyzer.analyze(textContent);
      final memory = Memory(
        id: _uuid.v4(),
        userId: userId,
        placeId: place.id,
        imageUrl: state.imagePath,
        textContent: textContent.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        geohash: Geohash.encode(
          latitude: location.latitude,
          longitude: location.longitude,
        ),
        sentiment: sentiment,
        privacy: state.privacy,
        taggedUserIds: const [],
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      );

      await _memoryRepository.create(memory);
      final publicMemories =
          (await _memoryRepository.watchMemoriesForPlace(place.id).first)
              .where((memory) => memory.privacy == PrivacyType.public)
              .toList();
      final aura = _auraCalculator.calculate(
        memories: publicMemories,
        now: now,
      );
      await _placeRepository.save(
        Place(
          id: place.id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          geohash: place.geohash,
          communityId: place.communityId,
          custodianIds: place.custodianIds,
          aura: aura,
          memoryCount: place.memoryCount + 1,
          publicMemoryCount:
              place.publicMemoryCount +
              (state.privacy == PrivacyType.public ? 1 : 0),
          createdAt: place.createdAt,
          updatedAt: now,
        ),
      );

      emit(state.copyWith(status: AddMemoryStatus.success));
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: AddMemoryStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }
}
