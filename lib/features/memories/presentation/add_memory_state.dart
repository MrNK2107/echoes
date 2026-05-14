import 'package:echoes/core/location/device_location.dart';
import 'package:echoes/features/memories/presentation/add_memory_status.dart';
import 'package:echoes/features/privacy/domain/privacy_type.dart';
import 'package:equatable/equatable.dart';

class AddMemoryState extends Equatable {
  const AddMemoryState({
    required this.status,
    this.privacy = PrivacyType.public,
    this.location,
    this.errorMessage,
  });

  const AddMemoryState.initial() : this(status: AddMemoryStatus.initial);

  final AddMemoryStatus status;
  final PrivacyType privacy;
  final DeviceLocation? location;
  final String? errorMessage;

  AddMemoryState copyWith({
    AddMemoryStatus? status,
    PrivacyType? privacy,
    DeviceLocation? location,
    String? errorMessage,
  }) {
    return AddMemoryState(
      status: status ?? this.status,
      privacy: privacy ?? this.privacy,
      location: location ?? this.location,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, privacy, location, errorMessage];
}
