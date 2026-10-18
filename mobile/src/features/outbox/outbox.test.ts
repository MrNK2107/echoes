import { fakeFiles, memoryKeyValue } from '@/device/fakes';
import type { FileStore } from '@/device/types';

import { outboxDraft } from './fixtures';
import { Outbox } from './outbox';

function spyFiles(): FileStore & { removed: string[]; persisted: [string, string][] } {
  const base = fakeFiles();
  const removed: string[] = [];
  const persisted: [string, string][] = [];
  return {
    removed,
    persisted,
    persist: async (uri, name) => {
      persisted.push([uri, name]);
      return base.persist(uri, name);
    },
    remove: async (uri) => {
      removed.push(uri);
    },
  };
}

describe('Outbox', () => {
  it('adds, lists and removes drafts', async () => {
    const outbox = new Outbox(memoryKeyValue(), fakeFiles(), 'user-demo');
    await outbox.add(outboxDraft({ memoryId: 'a' }));
    await outbox.add(outboxDraft({ memoryId: 'b' }));
    expect((await outbox.list()).map((d) => d.memoryId)).toEqual(['a', 'b']);
    await outbox.remove('a');
    expect((await outbox.list()).map((d) => d.memoryId)).toEqual(['b']);
  });

  it('replaces a draft added twice with the same memoryId', async () => {
    const outbox = new Outbox(memoryKeyValue(), fakeFiles(), 'user-demo');
    await outbox.add(outboxDraft());
    await outbox.add(outboxDraft({ textContent: 'again' }));
    expect(await outbox.list()).toHaveLength(1);
  });

  it('survives a new Outbox instance over the same store (restart)', async () => {
    const store = memoryKeyValue();
    await new Outbox(store, fakeFiles(), 'user-demo').add(outboxDraft());
    const reborn = new Outbox(store, fakeFiles(), 'user-demo');
    expect(await reborn.list()).toEqual([outboxDraft()]);
  });

  it('keeps drafts per user under outbox:<uid>', async () => {
    const store = memoryKeyValue();
    await new Outbox(store, fakeFiles(), 'alice').add(outboxDraft({ userId: 'alice' }));
    expect(await new Outbox(store, fakeFiles(), 'bob').list()).toEqual([]);
    expect(JSON.parse((await store.get('outbox:alice'))!)).toHaveLength(1);
    expect(await store.get('outbox:bob')).toBeNull();
  });

  it('persists media on add and deletes it on remove', async () => {
    const files = spyFiles();
    const outbox = new Outbox(memoryKeyValue(), files, 'user-demo');
    await outbox.add(outboxDraft({ imageUri: 'file:///cache/p.jpg', audioUri: 'file:///cache/v.m4a' }));
    expect(files.persisted).toEqual([
      ['file:///cache/p.jpg', 'm1.jpg'],
      ['file:///cache/v.m4a', 'm1.m4a'],
    ]);
    const [stored] = await outbox.list();
    expect(stored!.imageUri).toBe('persisted://m1.jpg');
    expect(stored!.audioUri).toBe('persisted://m1.m4a');
    await outbox.remove('m1');
    expect(files.removed.sort()).toEqual(['persisted://m1.jpg', 'persisted://m1.m4a']);
  });

  it('notifies subscribers with pending and failed counts', async () => {
    const outbox = new Outbox(memoryKeyValue(), fakeFiles(), 'user-demo');
    await outbox.add(outboxDraft({ memoryId: 'a' }));
    const counts: { pending: number; failed: number }[] = [];
    const off = outbox.subscribe((c) => counts.push(c));
    await Promise.resolve();
    await Promise.resolve();
    await outbox.add(outboxDraft({ memoryId: 'b' }));
    await outbox.markFailed('a', 'permission-denied: no');
    await outbox.remove('b');
    off();
    await outbox.remove('a');
    expect(counts).toEqual([
      { pending: 1, failed: 0 },
      { pending: 2, failed: 0 },
      { pending: 1, failed: 1 },
      { pending: 0, failed: 1 },
    ]);
  });

  it('parks a draft as failed, persisted, and resetFailed un-parks it', async () => {
    const store = memoryKeyValue();
    const outbox = new Outbox(store, fakeFiles(), 'user-demo');
    await outbox.add(outboxDraft());
    await outbox.markFailed('m1', 'storage/unauthorized: nope');
    const [parked] = await new Outbox(store, fakeFiles(), 'user-demo').list();
    expect(parked).toMatchObject({ memoryId: 'm1', failed: true, failedReason: 'storage/unauthorized: nope' });
    await outbox.resetFailed();
    expect(await outbox.list()).toEqual([outboxDraft()]);
  });

  it('discardFailed removes only failed drafts and their files', async () => {
    const files = spyFiles();
    const outbox = new Outbox(memoryKeyValue(), files, 'user-demo');
    await outbox.add(outboxDraft({ memoryId: 'bad', imageUri: 'file:///b.jpg' }));
    await outbox.add(outboxDraft({ memoryId: 'ok', imageUri: 'file:///o.jpg' }));
    await outbox.markFailed('bad', 'permission-denied: no');
    await outbox.discardFailed();
    expect((await outbox.list()).map((d) => d.memoryId)).toEqual(['ok']);
    expect(files.removed).toEqual(['persisted://bad.jpg']);
  });

  it('clear removes every draft and its files', async () => {
    const files = spyFiles();
    const store = memoryKeyValue();
    const outbox = new Outbox(store, files, 'user-demo');
    await outbox.add(outboxDraft({ memoryId: 'a', imageUri: 'file:///a.jpg' }));
    await outbox.add(outboxDraft({ memoryId: 'b', audioUri: 'file:///b.m4a' }));
    await outbox.markFailed('b', 'permission-denied: no');
    await outbox.clear();
    expect(await outbox.list()).toEqual([]);
    expect(files.removed.sort()).toEqual(['persisted://a.jpg', 'persisted://b.m4a']);
  });

  it('tracks in-flight submits in memory only', async () => {
    const store = memoryKeyValue();
    const outbox = new Outbox(store, fakeFiles(), 'user-demo');
    outbox.markInFlight('m1');
    expect(outbox.isInFlight('m1')).toBe(true);
    expect(new Outbox(store, fakeFiles(), 'user-demo').isInFlight('m1')).toBe(false);
    outbox.clearInFlight('m1');
    expect(outbox.isInFlight('m1')).toBe(false);
  });

  it('calls onAdded listeners after an add', async () => {
    const outbox = new Outbox(memoryKeyValue(), fakeFiles(), 'user-demo');
    const added = jest.fn();
    const off = outbox.onAdded(added);
    await outbox.add(outboxDraft());
    off();
    await outbox.add(outboxDraft({ memoryId: 'm2' }));
    expect(added).toHaveBeenCalledTimes(1);
  });
});
