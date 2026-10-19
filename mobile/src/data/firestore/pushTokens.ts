import { deleteDoc, doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import type { PushTokenRepository } from '../types';

const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/** users/{uid}/pushTokens/{tokenId}; tokenId = first 32 hex chars of SHA-256(token) (ADR-0009). */
export function createPushTokenRepository(
  db: Firestore,
  sha256Hex: (value: string) => Promise<string>,
): PushTokenRepository {
  const ref = async (uid: string, token: string) =>
    doc(db, 'users', uid, 'pushTokens', (await sha256Hex(token)).slice(0, 32));
  return {
    async register(uid, token, platform, at) {
      const r = await ref(uid, token);
      const snap = await getDoc(r);
      if (!snap.exists()) {
        const iso = at.toISOString();
        await setDoc(r, { token, platform, createdAt: iso, lastSeenAt: iso });
        return;
      }
      const seen = Date.parse(String(snap.data().lastSeenAt));
      // An unreadable stored value is refreshed; the rules allow lastSeenAt changes only.
      if (Number.isNaN(seen) || at.getTime() - seen > REFRESH_AFTER_MS) {
        await updateDoc(r, { lastSeenAt: at.toISOString() });
      }
    },
    async unregister(uid, token) {
      await deleteDoc(await ref(uid, token));
    },
    async get(uid, token) {
      const snap = await getDoc(await ref(uid, token));
      const d = snap.data();
      if (!d) return null;
      return {
        token: String(d.token),
        platform: d.platform === 'ios' ? 'ios' : 'android',
        createdAt: new Date(String(d.createdAt)),
        lastSeenAt: new Date(String(d.lastSeenAt)),
      };
    },
  };
}
