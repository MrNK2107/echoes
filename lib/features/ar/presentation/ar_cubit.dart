import 'package:echoes/features/ar/domain/ar_availability.dart';
import 'package:echoes/features/ar/domain/ar_availability_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_service.dart';
import 'package:echoes/features/ar/domain/ar_permission_state.dart';
import 'package:echoes/features/ar/domain/ar_session_service.dart';
import 'package:echoes/features/ar/presentation/ar_state.dart';
import 'package:echoes/features/ar/presentation/ar_status.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class ArCubit extends Cubit<ArState> {
  ArCubit({
    required ArAvailabilityService availabilityService,
    required ArPermissionService permissionService,
    required ArSessionService sessionService,
  }) : _sessionService = sessionService,
       _permissionService = permissionService,
       _availabilityService = availabilityService,
       super(const ArState.initial());

  final ArAvailabilityService _availabilityService;
  final ArPermissionService _permissionService;
  final ArSessionService _sessionService;

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
          isSessionRunning: false,
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
          isSessionRunning: false,
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

  Future<void> startSession() async {
    if (state.status != ArStatus.ready) {
      return;
    }

    emit(state.copyWith(status: ArStatus.starting));
    try {
      await _sessionService.start();
      emit(state.copyWith(status: ArStatus.running, isSessionRunning: true));
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: ArStatus.failure,
          errorMessage: error.toString(),
          isSessionRunning: false,
        ),
      );
    }
  }

  Future<void> stopSession() async {
    if (!state.isSessionRunning) {
      return;
    }

    emit(state.copyWith(status: ArStatus.stopping));
    try {
      await _sessionService.stop();
      emit(state.copyWith(status: ArStatus.ready, isSessionRunning: false));
    } on Object catch (error) {
      emit(
        state.copyWith(
          status: ArStatus.failure,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  @override
  Future<void> close() async {
    if (state.isSessionRunning) {
      await _sessionService.stop();
    }
    return super.close();
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
