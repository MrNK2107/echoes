import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { messageOf, OWNER_CANNOT_LEAVE } from '@/data/errors';
import { useSession } from '@/features/auth/useSession';
import { UserSearchField } from '@/features/people/UserSearchField';
import { useAuthorNames } from '@/features/people/useAuthorNames';
import { MemoryCard } from '@/features/places/MemoryCard';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { useBlocksState, withoutBlocked } from '@/features/safety/useBlocks';
import { useServices } from '@/services/ServicesProvider';
import {
  FEED_LOAD_ERROR,
  INVITE_CAP_ERROR,
  MEMBERSHIP_ERROR,
  REMOVE_INVITED_LABEL,
  REPORT_COMMUNITY_LABEL,
  REPORT_THANKS,
  RETRY_LABEL,
} from '@/ui/copy';
import { Notice } from '@/ui/Notice';
import { colors } from '@/ui/theme';

import { communityTypeLabel, formatMembers, hasHumanOwner } from './labels';
import { useCommunity } from './useCommunity';

const FEED_EMPTY = 'No memories shared with this community yet.';
const INVITES_SENT = 'Invitations sent.';

export function CommunityScreen({ communityId }: { communityId: string }) {
  const router = useRouter();
  const { repos } = useServices();
  const { session } = useSession();
  const { status, community, membership, membershipError, retryMembership, feed } = useCommunity(communityId);
  const blocks = useBlocksState();

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Nothing renders until the block list is known, so a blocked author's memory never flashes.
  const memories = useMemo(
    () => (blocks.ready ? withoutBlocked(feed.memories, blocks.blocked) : []),
    [feed.memories, blocks.ready, blocks.blocked],
  );
  const feedReady = feed.status === 'ready' && blocks.ready;
  const feedError = feed.status === 'error' || blocks.error;
  const authorIds = useMemo(() => memories.map((m) => m.userId), [memories]);
  const names = useAuthorNames(authorIds);
  const ownerIds = useMemo(() => (community && hasHumanOwner(community) ? [community.ownerId] : []), [community]);
  const ownerNames = useAuthorNames(ownerIds);

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
      <Text style={styles.backText}>{'< Back'}</Text>
    </Pressable>
  );

  if (!community) {
    return (
      <View style={styles.container}>
        {back}
        <View style={styles.center}>
          {status === 'notFound' ? <Text style={styles.message}>This community no longer exists.</Text> : null}
          {status === 'error' ? <Text style={styles.message}>{"Couldn't load this community."}</Text> : null}
          {status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
        </View>
      </View>
    );
  }

  const isMember = membership !== null && membership !== undefined;
  const isOwner = membership?.role === 'owner' || community.ownerId === session?.userId;
  const ownerName = hasHumanOwner(community) ? ownerNames.get(community.ownerId) : undefined;
  const members = formatMembers(community.memberCount);
  // Staff-run communities (system-owned or institution-backed) and your own are not reported from here.
  const canReport = !isOwner && hasHumanOwner(community) && community.type !== 'institution' && !community.institutionId;

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const join = () => run(() => repos.communities.join(community.id));

  const leave = () => {
    setNotice(null);
    if (isOwner) {
      setError(OWNER_CANNOT_LEAVE);
      return;
    }
    Alert.alert(`Leave ${community.name}?`, 'You can join again any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => void run(() => repos.communities.leave(community.id)) },
    ]);
  };

  const closeInvite = () => {
    if (sendingRef.current) return;
    setInviting(false);
    setInvitees([]);
    setInviteError(null);
  };

  const sendInvites = async () => {
    if (sendingRef.current || invitees.length === 0) return;
    sendingRef.current = true;
    setSending(true);
    setInviteError(null);
    try {
      await repos.communities.invite(community.id, invitees);
      setInviting(false);
      setInvitees([]);
      setNotice(INVITES_SENT);
    } catch (e) {
      setInviteError(messageOf(e));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.title}>
        {community.name}
      </Text>
      {community.description ? <Text style={styles.description}>{community.description}</Text> : null}
      <View style={styles.metaRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{communityTypeLabel(community.type)}</Text>
        </View>
        <Text style={styles.meta}>{members}</Text>
      </View>
      {ownerName ? <Text style={styles.meta}>{`Owned by ${ownerName}`}</Text> : null}

      {membership !== undefined ? (
        <View style={styles.actions}>
          {isMember ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={`You are a member of ${community.name}`}
              accessibilityState={{ busy, disabled: busy }}
              disabled={busy}
              onPress={leave}
              style={[styles.secondary, busy && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Leave</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={`You are not a member of ${community.name}`}
              accessibilityState={{ busy, disabled: busy }}
              disabled={busy}
              onPress={() => void join()}
              style={[styles.primary, busy && styles.disabled]}
            >
              <Text style={styles.primaryText}>Join</Text>
            </Pressable>
          )}
          {isMember ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setNotice(null);
                setInviting(true);
              }}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Invite</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {membershipError ? (
        <View style={styles.actions}>
          <Text accessibilityRole="alert" style={styles.error}>
            {MEMBERSHIP_ERROR}
          </Text>
          <Pressable accessibilityRole="button" onPress={retryMembership} style={styles.secondary}>
            <Text style={styles.secondaryText}>{RETRY_LABEL}</Text>
          </Pressable>
        </View>
      ) : null}
      {canReport ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setNotice(null);
              setReporting(true);
            }}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>{REPORT_COMMUNITY_LABEL}</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Notice message={notice} style={styles.notice} />
      {feedError ? <Text style={styles.message}>{FEED_LOAD_ERROR}</Text> : null}
      {!feedReady && !feedError && !membershipError ? <ActivityIndicator style={styles.spinner} color={colors.accent} /> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {back}
      <FlatList
        contentContainerStyle={styles.list}
        data={memories}
        keyExtractor={(m) => m.id}
        extraData={names}
        ListHeaderComponent={header}
        renderItem={({ item }) => <MemoryCard memory={item} authorName={names.get(item.userId)} />}
        ListEmptyComponent={feedReady ? <Text style={styles.message}>{FEED_EMPTY}</Text> : undefined}
      />

      <ReportSheet
        visible={reporting}
        target={{ type: 'community', id: community.id }}
        onClose={() => setReporting(false)}
        onReported={() => {
          setReporting(false);
          setNotice(REPORT_THANKS);
        }}
      />

      <Modal visible={inviting} animationType="slide" transparent onRequestClose={closeInvite}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {`Invite to ${community.name}`}
            </Text>
            <UserSearchField
              selectedIds={invitees}
              onChange={setInvitees}
              capMessage={INVITE_CAP_ERROR}
              removeFallbackLabel={REMOVE_INVITED_LABEL}
            />
            {inviteError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {inviteError}
              </Text>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: sending }}
                disabled={sending}
                onPress={closeInvite}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: sending || invitees.length === 0, busy: sending }}
                disabled={sending || invitees.length === 0}
                onPress={() => void sendInvites()}
                style={[styles.primary, (sending || invitees.length === 0) && styles.disabled]}
              >
                <Text style={styles.primaryText}>Send invitations</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  back: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { color: colors.accent, fontSize: 16 },
  header: { paddingBottom: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600' },
  description: { color: colors.text, fontSize: 16, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 4 },
  badge: { backgroundColor: colors.elevated, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: colors.gold, fontSize: 12 },
  meta: { color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  primary: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  primaryText: { color: colors.background, fontWeight: '600' },
  secondary: { borderColor: colors.accent, borderWidth: 1, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryText: { color: colors.accent, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, marginTop: 8 },
  notice: { marginTop: 8, padding: 0, textAlign: 'left' },
  list: { padding: 16 },
  spinner: { marginTop: 16 },
  message: { color: colors.textSecondary, textAlign: 'center', padding: 16 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 12 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
});
