enum CommunityRole {
  owner,
  guardian,
  member,
  visitor;

  bool get canModerate =>
      this == CommunityRole.owner || this == CommunityRole.guardian;

  bool get canAddMemories => this != CommunityRole.visitor;
}
