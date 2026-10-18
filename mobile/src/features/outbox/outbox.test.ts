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

  it('notifies subscribers with the pending count', async () => {
    const outbox = new Outbox(memoryKeyValue(), fakeFiles(), 'user-demo');
    await outbox.add(outboxDraft({ memoryId: 'a' }));
    const counts: number[] = [];
    const off = outbox.subscribe((n) => counts.push(n));
    await Promise.resolve();
    await Promise.resolve();
    await outbox.add(outboxDraft({ memoryId: 'b' }));
    await outbox.remove('a');
    off();
    await outbox.remove('b');
    expect(counts).toEqual([1, 2, 1]);
  });
});
