import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:equatable/equatable.dart';

class ArState extends Equatable {
  const ArState({required this.status, this.errorMessage});

  const ArState.initial() : this(status: ArStatus.initial);

  final ArStatus status;
  final String? errorMessage;

  ArState copyWith({ArStatus? status, String? errorMessage}) {
    return ArState(status: status ?? this.status, errorMessage: errorMessage);
  }

  @override
  List<Object?> get props => [status, errorMessage];
}
