enum ArPermissionState {
  unknown,
  granted,
  denied,
  permanentlyDenied;

  bool get canStartSession => this == ArPermissionState.granted;
}
