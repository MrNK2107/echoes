import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ArCubit extends Cubit<ArState> {
  ArCubit({
    required ArAvailabilityService availabilityService,
    required ArPermissionService permissionService,
  }) : _permissionService = permissionService,
       _availabilityService = availabilityService,
       super(const ArState.initial());

  final ArAvailabilityService _availabilityService;
  final ArPermissionService _permissionService;

  Future<void> checkAvailability() async {
    emit(state.copyWith(status: ArStatus.checking));
    try {
      final availability = await _availabilityService.checkAvailability();
      if (availability != ArAvailability.supported) {
        emit(state.copyWith(status: ArStatus.unsupported));
        return;
      }

      final permission = await _permissionService.checkPermission();
      emit(
        state.copyWith(
          status: _statusForPermission(permission),
          isPermissionPermanentlyDenied:
              permission == ArPermissionState.permanentlyDenied,
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

  Future<void> requestPermission() async {
    emit(state.copyWith(status: ArStatus.checking));
    try {
      final permission = await _permissionService.requestPermission();
      emit(
        state.copyWith(
          status: _statusForPermission(permission),
          isPermissionPermanentlyDenied:
              permission == ArPermissionState.permanentlyDenied,
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

  ArStatus _statusForPermission(ArPermissionState permission) {
    return switch (permission) {
      ArPermissionState.granted => ArStatus.ready,
      ArPermissionState.unknown => ArStatus.permissionRequired,
      ArPermissionState.denied ||
      ArPermissionState.permanentlyDenied => ArStatus.permissionDenied,
    };
  }
}
