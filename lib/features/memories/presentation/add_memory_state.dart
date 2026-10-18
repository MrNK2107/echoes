import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:equatable/equatable.dart';

class AddMemoryState extends Equatable {
  const AddMemoryState({
    required this.status,
    this.privacy = PrivacyType.public,
    this.imagePath,
    this.audioPath,
    this.isRecording = false,
    this.recordingSeconds = 0,
    this.taggedUserIds = const [],
    this.releaseDate,
    this.communityId,
    this.location,
    this.errorMessage,
  });

  const AddMemoryState.initial({PrivacyType privacy = PrivacyType.public})
    : this(status: AddMemoryStatus.initial, privacy: privacy);

  final AddMemoryStatus status;
  final PrivacyType privacy;
  final String? imagePath;
  final String? audioPath;
  final bool isRecording;
  final int recordingSeconds;
  final List<String> taggedUserIds;
  final DateTime? releaseDate;
  final String? communityId;
  final DeviceLocation? location;
  final String? errorMessage;

  AddMemoryState copyWith({
    AddMemoryStatus? status,
    PrivacyType? privacy,
    String? imagePath,
    String? audioPath,
    bool clearAudioPath = false,
    bool? isRecording,
    int? recordingSeconds,
    List<String>? taggedUserIds,
    DateTime? releaseDate,
    String? communityId,
    DeviceLocation? location,
    String? errorMessage,
  }) {
    return AddMemoryState(
      status: status ?? this.status,
      privacy: privacy ?? this.privacy,
      imagePath: imagePath ?? this.imagePath,
      audioPath: clearAudioPath ? null : audioPath ?? this.audioPath,
      isRecording: isRecording ?? this.isRecording,
      recordingSeconds: recordingSeconds ?? this.recordingSeconds,
      taggedUserIds: taggedUserIds ?? this.taggedUserIds,
      releaseDate: releaseDate ?? this.releaseDate,
      communityId: communityId ?? this.communityId,
      location: location ?? this.location,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [
    status,
    privacy,
    imagePath,
    audioPath,
    isRecording,
    recordingSeconds,
    taggedUserIds,
    releaseDate,
    communityId,
    location,
    errorMessage,
  ];
}
