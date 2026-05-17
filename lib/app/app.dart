import 'package:echoes/app/theme.dart';
import 'package:echoes/core/cache/app_cache_registry.dart';
import 'package:echoes/core/config/app_config.dart';
import 'package:echoes/core/location/geolocator_location_service.dart';
import 'package:echoes/core/location/location_service.dart';
import 'package:echoes/core/media/dart_image_compression_service.dart';
import 'package:echoes/core/media/firebase_storage_media_upload_service.dart';
import 'package:echoes/core/media/image_compression_service.dart';
import 'package:echoes/core/media/image_picker_media_service.dart';
import 'package:echoes/core/media/local_image_cache.dart';
import 'package:echoes/core/media/local_media_upload_service.dart';
import 'package:echoes/core/media/media_picker_service.dart';
import 'package:echoes/core/media/media_upload_service.dart';
import 'package:echoes/features/ar/data/device_ar_availability_service.dart';
import 'package:echoes/features/ar/data/device_ar_permission_service.dart';
import 'package:echoes/features/ar/data/local_ar_availability_service.dart';
import 'package:echoes/features/ar/data/local_ar_permission_service.dart';
import 'package:echoes/features/ar/data/local_ar_session_service.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:echoes/features/aura/data/lexicon_sentiment_analyzer.dart';
import 'package:echoes/features/aura/domain/sentiment_analyzer.dart';
import 'package:echoes/features/auth/data/firebase_auth_repository.dart';
import 'package:echoes/features/auth/data/local_auth_repository.dart';
import 'package:echoes/features/auth/domain/auth_repository.dart';
import 'package:echoes/features/auth/presentation/auth_cubit.dart';
import 'package:echoes/features/auth/presentation/auth_gate.dart';
import 'package:echoes/features/communities/data/firestore_community_repository.dart';
import 'package:echoes/features/communities/data/local_community_repository.dart';
import 'package:echoes/features/communities/domain/community_repository.dart';
import 'package:echoes/features/legacy/application/custodianship_transfer_service.dart';
import 'package:echoes/features/legacy/data/firestore_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/data/local_legacy_transfer_repository.dart';
import 'package:echoes/features/legacy/domain/legacy_transfer_repository.dart';
import 'package:echoes/features/memories/application/pending_memory_upload_sync.dart';
import 'package:echoes/features/memories/data/cached_memory_repository.dart';
import 'package:echoes/features/memories/data/firestore_memory_repository.dart';
import 'package:echoes/features/memories/data/local_memory_repository.dart';
import 'package:echoes/features/memories/data/local_pending_memory_upload_queue.dart';
import 'package:echoes/features/memories/domain/memory_repository.dart';
import 'package:echoes/features/memories/domain/pending_memory_upload_queue.dart';
import 'package:echoes/features/notifications/data/device_notification_permission_service.dart';
import 'package:echoes/features/notifications/data/local_notification_permission_service.dart';
import 'package:echoes/features/notifications/domain/notification_permission_service.dart';
import 'package:echoes/features/places/data/cached_place_repository.dart';
import 'package:echoes/features/places/data/firestore_place_repository.dart';
import 'package:echoes/features/places/data/local_place_repository.dart';
import 'package:echoes/features/places/domain/place_repository.dart';
import 'package:echoes/features/users/data/cached_app_user_repository.dart';
import 'package:echoes/features/users/data/firestore_app_user_repository.dart';
import 'package:echoes/features/users/data/local_app_user_repository.dart';
import 'package:echoes/features/users/domain/app_user_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class EchoesApp extends StatelessWidget {
  const EchoesApp({super.key, this.config, this.useFirebase = false});

  final AppConfig? config;
  final bool useFirebase;

  @override
  Widget build(BuildContext context) {
    final appConfig = config ?? AppConfig.fromEnvironment();
    final cacheRegistry = AppCacheRegistry();
    final localImageCache = LocalImageCache();
    cacheRegistry.register(localImageCache);
    final authRepository = useFirebase
        ? FirebaseAuthRepository()
        : LocalAuthRepository();
    final appUserRepository = CachedAppUserRepository(
      useFirebase ? FirestoreAppUserRepository() : LocalAppUserRepository(),
      cacheRegistry: cacheRegistry,
    );
    final mediaUploadService = useFirebase
        ? FirebaseStorageMediaUploadService()
        : const LocalMediaUploadService();
    final placeRepository = CachedPlaceRepository(
      useFirebase ? FirestorePlaceRepository() : LocalPlaceRepository(),
      cacheRegistry: cacheRegistry,
    );
    final memoryRepository = CachedMemoryRepository(
      useFirebase ? FirestoreMemoryRepository() : LocalMemoryRepository(),
      cacheRegistry: cacheRegistry,
    );
    final pendingMemoryUploadQueue = LocalPendingMemoryUploadQueue();
    final communityRepository = useFirebase
        ? FirestoreCommunityRepository()
        : LocalCommunityRepository();
    final legacyTransferRepository = useFirebase
        ? FirestoreLegacyTransferRepository()
        : LocalLegacyTransferRepository();
    final arAvailabilityService = useFirebase
        ? const DeviceArAvailabilityService()
        : const LocalArAvailabilityService();
    final arPermissionService = useFirebase
        ? const DeviceArPermissionService()
        : const LocalArPermissionService();
    final notificationPermissionService = useFirebase
        ? const DeviceNotificationPermissionService()
        : const LocalNotificationPermissionService();

    return MaterialApp(
      title: appConfig.appTitle,
      debugShowCheckedModeBanner: !appConfig.isProduction,
      theme: EchoesTheme.dark,
      highContrastTheme: EchoesTheme.highContrastDark,
      home: MultiRepositoryProvider(
        providers: [
          RepositoryProvider<AuthRepository>(create: (_) => authRepository),
          RepositoryProvider<AppCacheRegistry>(create: (_) => cacheRegistry),
          RepositoryProvider<LocalImageCache>(create: (_) => localImageCache),
          RepositoryProvider<AppUserRepository>(
            create: (_) => appUserRepository,
          ),
          RepositoryProvider<LocationService>(
            create: (_) => GeolocatorLocationService(),
          ),
          RepositoryProvider<MediaPickerService>(
            create: (_) => ImagePickerMediaService(),
          ),
          RepositoryProvider<ImageCompressionService>(
            create: (_) => DartImageCompressionService(),
          ),
          RepositoryProvider<MediaUploadService>(
            create: (_) => mediaUploadService,
          ),
          RepositoryProvider<SentimentAnalyzer>(
            create: (_) => LexiconSentimentAnalyzer(),
          ),
          RepositoryProvider<ArAvailabilityService>(
            create: (_) => arAvailabilityService,
          ),
          RepositoryProvider<ArPermissionService>(
            create: (_) => arPermissionService,
          ),
          RepositoryProvider<NotificationPermissionService>(
            create: (_) => notificationPermissionService,
          ),
          RepositoryProvider<ArSessionService>(
            create: (_) => LocalArSessionService(),
          ),
          RepositoryProvider<PlaceRepository>(create: (_) => placeRepository),
          RepositoryProvider<MemoryRepository>(create: (_) => memoryRepository),
          RepositoryProvider<PendingMemoryUploadQueue>(
            create: (_) => pendingMemoryUploadQueue,
          ),
          RepositoryProvider<PendingMemoryUploadSync>(
            create: (_) => PendingMemoryUploadSync(
              queue: pendingMemoryUploadQueue,
              mediaUploadService: mediaUploadService,
              memoryRepository: memoryRepository,
            ),
          ),
          RepositoryProvider<CommunityRepository>(
            create: (_) => communityRepository,
          ),
          RepositoryProvider<LegacyTransferRepository>(
            create: (_) => legacyTransferRepository,
          ),
          RepositoryProvider<CustodianshipTransferService>(
            create: (_) => CustodianshipTransferService(
              transferRepository: legacyTransferRepository,
              placeRepository: placeRepository,
            ),
          ),
        ],
        child: BlocProvider(
          create: (context) => AuthCubit(
            repository: context.read<AuthRepository>(),
            userRepository: context.read<AppUserRepository>(),
          )..start(),
          child: const AuthGate(),
        ),
      ),
    );
  }
}
