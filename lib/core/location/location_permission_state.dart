enum LocationPermissionState {
  unknown,
  denied,
  deniedForever,
  granted;

  bool get canRequestAgain => this == LocationPermissionState.denied;

  bool get isGranted => this == LocationPermissionState.granted;
}
