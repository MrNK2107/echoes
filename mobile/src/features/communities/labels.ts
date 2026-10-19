import type { Community, CommunityType } from '@/domain/types';

export const formatMembers = (n: number) => (n === 1 ? '1 member' : `${n} members`);

const TYPE_LABELS: Record<CommunityType, string> = {
  geographic: 'Place',
  thematic: 'Interest',
  timeBased: 'Time',
  institution: 'Institution',
};

export const communityTypeLabel = (type: CommunityType) => TYPE_LABELS[type];

/** Auto communities are owned by 'system' (R25): no human owner, every member may leave. */
export const SYSTEM_OWNER = 'system';

export const hasHumanOwner = (c: Community) => c.ownerId !== SYSTEM_OWNER;
