enum PrivacyType {
  public,
  private,
  tagged,
  timeRelease,
  community;

  bool get requiresTaggedUsers => this == PrivacyType.tagged;

  bool get requiresReleaseDate => this == PrivacyType.timeRelease;

  bool get requiresCommunity => this == PrivacyType.community;
}
