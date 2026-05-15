import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:equatable/equatable.dart';

class ArState extends Equatable {
  const ArState({
    required this.status,
    this.errorMessage,
    this.isPermissionPermanentlyDenied = false,
  });

  const ArState.initial() : this(status: ArStatus.initial);

  final ArStatus status;
  final String? errorMessage;
  final bool isPermissionPermanentlyDenied;

  ArState copyWith({
    ArStatus? status,
    String? errorMessage,
    bool? isPermissionPermanentlyDenied,
  }) {
    return ArState(
      status: status ?? this.status,
      errorMessage: errorMessage,
      isPermissionPermanentlyDenied:
          isPermissionPermanentlyDenied ?? this.isPermissionPermanentlyDenied,
    );
  }

  @override
  List<Object?> get props => [
    status,
    errorMessage,
    isPermissionPermanentlyDenied,
  ];
}
