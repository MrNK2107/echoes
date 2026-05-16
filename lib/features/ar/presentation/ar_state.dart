import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:equatable/equatable.dart';

class ArState extends Equatable {
  const ArState({
    required this.status,
    this.errorMessage,
    this.isPermissionPermanentlyDenied = false,
    this.isSessionRunning = false,
  });

  const ArState.initial() : this(status: ArStatus.initial);

  final ArStatus status;
  final String? errorMessage;
  final bool isPermissionPermanentlyDenied;
  final bool isSessionRunning;

  ArState copyWith({
    ArStatus? status,
    String? errorMessage,
    bool? isPermissionPermanentlyDenied,
    bool? isSessionRunning,
  }) {
    return ArState(
      status: status ?? this.status,
      errorMessage: errorMessage,
      isPermissionPermanentlyDenied:
          isPermissionPermanentlyDenied ?? this.isPermissionPermanentlyDenied,
      isSessionRunning: isSessionRunning ?? this.isSessionRunning,
    );
  }

  @override
  List<Object?> get props => [
    status,
    errorMessage,
    isPermissionPermanentlyDenied,
    isSessionRunning,
  ];
}
