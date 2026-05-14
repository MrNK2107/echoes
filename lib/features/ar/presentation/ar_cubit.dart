import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ArCubit extends Cubit<ArState> {
  ArCubit({required ArAvailabilityService availabilityService})
    : _availabilityService = availabilityService,
      super(const ArState.initial());

  final ArAvailabilityService _availabilityService;

  Future<void> checkAvailability() async {
    emit(state.copyWith(status: ArStatus.checking));
    try {
      final availability = await _availabilityService.checkAvailability();
      emit(
        state.copyWith(
          status: availability == ArAvailability.supported
              ? ArStatus.ready
              : ArStatus.unsupported,
        ),
      );
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: ArStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }
}
