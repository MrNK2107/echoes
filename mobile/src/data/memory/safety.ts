import { callableFailure, mapCallableError, REPORT_ERRORS } from '../callableErrors';
import { GENERIC_ERROR } from '../errors';
import type { ReportReason } from '@/domain/types';
import type { SafetyRepository } from '../types';
import { recomputePlace } from './recompute';
import { canRead } from './visibility';
import type { Store } from './store';

const HIDE_AT = 3;
const REPORTS_PER_DAY = 20;
const NOTE_MAX = 280;
const REASONS: readonly ReportReason[] = ['spam', 'harassment', 'hate', 'sexual', 'violence', 'other'];

/**
 * In-process emulation of the reportMemory callable (functions/safety.js + lib/callable.js):
 * auth, input validation, the daily rate limit (consumed before the handler, as the server does),
 * then the handler's checks and the auto-hide at the third distinct reporter.
 */
function emulateReportMemory(
  store: Store,
  input: { memoryId: string; reason: ReportReason; note: string | null },
): void {
  const uid = store.session?.userId;
  if (!uid) throw callableFailure('unauthenticated');
  const note = input.note?.trim() || null;
  if (!REASONS.includes(input.reason) || (note !== null && [...note].length > NOTE_MAX)) {
    throw callableFailure('invalid-argument');
  }
  const now = store.now();
  if (!store.consumeRateLimit(uid, 'reportMemory', REPORTS_PER_DAY)) throw callableFailure('resource-exhausted');

  const memory = store.memories.get(input.memoryId);
  // Own memory and missing / unreadable memories get the same answer, as on the server.
  if (!memory || memory.userId === uid || !canRead(store, memory, uid)) {
    throw callableFailure('failed-precondition');
  }
  const reportId = `${input.memoryId}_${uid}`;
  if (store.reports.has(reportId)) throw callableFailure('already-exists');
  const reporterVerified = store.accountOf(uid)?.emailVerified === true;
  store.reports.set(reportId, {
    memoryId: input.memoryId, reporterId: uid, reporterVerified, reason: input.reason, note, createdAt: now,
  });
  // Only verified reporters count (one doc per reporter, so docs are distinct reporters).
  const reporters = [...store.reports.values()].filter(
    (r) => r.memoryId === input.memoryId && r.reporterVerified,
  ).length;
  if (reporterVerified && reporters === HIDE_AT && memory.moderation !== 'hidden') {
    store.memories.set(memory.id, { ...memory, moderation: 'hidden' });
    // The moderation write re-runs onMemoryWritten on the server (a new aura history entry).
    recomputePlace(store, memory.placeId);
    store.notify(store.memoryListeners);
    store.notify(store.placeListeners);
  }
}

/** In-process emulation of the reportContent callable: records the report, never hides. */
function emulateReportContent(
  store: Store,
  input: { targetType: 'community' | 'profile'; targetId: string; reason: ReportReason; note: string | null },
): void {
  const uid = store.session?.userId;
  if (!uid) throw callableFailure('unauthenticated');
  const note = input.note?.trim() || null;
  if (
    (input.targetType !== 'community' && input.targetType !== 'profile') ||
    !REASONS.includes(input.reason) ||
    (note !== null && [...note].length > NOTE_MAX)
  ) {
    throw callableFailure('invalid-argument');
  }
  const now = store.now();
  if (!store.consumeRateLimit(uid, 'reportMemory', REPORTS_PER_DAY)) throw callableFailure('resource-exhausted');
  const exists =
    input.targetType === 'community' ? store.communities.has(input.targetId) : store.profiles.has(input.targetId);
  if (!exists || (input.targetType === 'profile' && input.targetId === uid)) {
    throw callableFailure('failed-precondition');
  }
  const reportId = `${input.targetType}_${input.targetId}_${uid}`;
  if (store.reports.has(reportId)) throw callableFailure('already-exists');
  store.reports.set(reportId, {
    targetType: input.targetType,
    targetId: input.targetId,
    reporterId: uid,
    reporterVerified: store.accountOf(uid)?.emailVerified === true,
    reason: input.reason,
    note,
    createdAt: now,
  });
}

export function createSafetyRepository(store: Store): SafetyRepository {
  const blocksOf = (uid: string) => {
    let b = store.blocks.get(uid);
    if (!b) {
      b = new Map();
      store.blocks.set(uid, b);
    }
    return b;
  };
  return {
    async block(uid, other, at) {
      // The rules refuse a self-block (otherUserId != userId).
      if (uid === other) throw new Error(GENERIC_ERROR);
      blocksOf(uid).set(other, at);
      store.notify(store.blockListeners);
    },
    async unblock(uid, other) {
      blocksOf(uid).delete(other);
      store.notify(store.blockListeners);
    },
    subscribeBlocks(uid, cb) {
      const emit = () =>
        cb(
          [...(store.blocks.get(uid)?.entries() ?? [])]
            .sort(([, a], [, b]) => b.getTime() - a.getTime())
            .map(([id]) => id),
        );
      store.blockListeners.add(emit);
      emit();
      return () => { store.blockListeners.delete(emit); };
    },
    async reportMemory(input) {
      try {
        emulateReportMemory(store, input);
      } catch (e) {
        throw mapCallableError(e, REPORT_ERRORS);
      }
    },
    async reportContent(input) {
      try {
        emulateReportContent(store, input);
      } catch (e) {
        throw mapCallableError(e, REPORT_ERRORS);
      }
    },
  };
}
