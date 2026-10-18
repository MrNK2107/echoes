import { fakeConnectivity, fakeFiles, memoryKeyValue, testServices } from '@/device/fakes';
import type { FileStore } from '@/device/types';
import type { Memory } from '@/domain/types';
import type { Services } from '@/services/services';

import { outboxDraft } from './fixtures';
import { Outbox } from './outbox';
import { OutboxProcessor } from './processor';

const unavailable = () => Object.assign(new Error('offline'), { code: 'unavailable' });

function setup(o: { online?: boolean; files?: FileStore } = {}) {
  const connectivity = fakeConnectivity(o.online ?? true);
  const services: Services = testServices({ connectivity });
  const outbox = new Outbox(memoryKeyValue(), o.files ?? fakeFiles(), 'user-demo');
  const processor = new OutboxProcessor(services, outbox);
  return { services, connectivity, outbox, processor };
}

describe('OutboxProcessor', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('replays on start and removes the draft and its files', async () => {
    const removed: string[] = [];
    const { services, outbox, processor } = setup({
      files: { ...fakeFiles(), remove: async (u) => void removed.push(u) },
    });
    await outbox.add(outboxDraft({ imageUri: 'file:///p.jpg' }));
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(await outbox.list()).toEqual([]);
    expect(removed).toEqual(['persisted://m1.jpg']);
    const created = await new Promise<Memory[]>((resolve) =>
      services.repos.memories.subscribeForUser('user-demo', resolve)(),
    );
    expect(created.some((m) => m.id === 'm1')).toBe(true);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('waits while offline and replays when connectivity flips online', async () => {
    const { services, connectivity, outbox, processor } = setup({ online: false });
    const create = jest.spyOn(services.repos.memories, 'create');
    await outbox.add(outboxDraft());
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(create).not.toHaveBeenCalled();
    expect(await outbox.list()).toHaveLength(1);

    connectivity.setOnline(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await outbox.list()).toEqual([]);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('backs off 2, 4, 8 s and resets after a success', async () => {
    const { services, outbox, processor } = setup();
    const realCreate = services.repos.memories.create.bind(services.repos.memories);
    const create = jest
      .spyOn(services.repos.memories, 'create')
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockImplementation(realCreate);
    await outbox.add(outboxDraft());
    const stop = processor.start();

    await jest.advanceTimersByTimeAsync(0);
    expect(create).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1_999);
    expect(create).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(create).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(3_999);
    expect(create).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(create).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(7_999);
    expect(create).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(1);
    expect(create).toHaveBeenCalledTimes(4);
    expect(await outbox.list()).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);

    // After the success the schedule starts again at 2 s.
    create.mockRejectedValueOnce(unavailable());
    await outbox.add(outboxDraft({ memoryId: 'm2', placeIdIfNew: 'p_m2' }));
    await processor.retryNow();
    expect(create).toHaveBeenCalledTimes(5);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(create).toHaveBeenCalledTimes(6);
    expect(await outbox.list()).toEqual([]);
    stop();
  });

  it('retryNow runs immediately and resets the backoff', async () => {
    const { services, outbox, processor } = setup();
    const create = jest.spyOn(services.repos.memories, 'create').mockRejectedValue(unavailable());
    await outbox.add(outboxDraft());
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(0); // fail -> 2 s
    await jest.advanceTimersByTimeAsync(2_000); // fail -> 4 s
    await jest.advanceTimersByTimeAsync(4_000); // fail -> 8 s
    expect(create).toHaveBeenCalledTimes(3);
    await processor.retryNow(); // fail -> 2 s again
    expect(create).toHaveBeenCalledTimes(4);
    await jest.advanceTimersByTimeAsync(2_000);
    expect(create).toHaveBeenCalledTimes(5);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('caps the backoff at 64 s', async () => {
    const { services, outbox, processor } = setup();
    const create = jest.spyOn(services.repos.memories, 'create').mockRejectedValue(unavailable());
    await outbox.add(outboxDraft());
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(0);
    for (const s of [2, 4, 8, 16, 32, 64, 64]) await jest.advanceTimersByTimeAsync(s * 1000);
    expect(create).toHaveBeenCalledTimes(8);
    await jest.advanceTimersByTimeAsync(63_999);
    expect(create).toHaveBeenCalledTimes(8);
    await jest.advanceTimersByTimeAsync(1);
    expect(create).toHaveBeenCalledTimes(9);
    stop();
  });

  it('treats a replay that hangs for 15 s as a failure and keeps the draft', async () => {
    const { services, outbox, processor } = setup();
    jest.spyOn(services.repos.memories, 'create').mockReturnValue(new Promise(() => {}));
    await outbox.add(outboxDraft());
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await outbox.list()).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(1); // the 2 s backoff
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops listening and retrying after stop()', async () => {
    const { services, connectivity, outbox, processor } = setup();
    const create = jest.spyOn(services.repos.memories, 'create').mockRejectedValue(unavailable());
    await outbox.add(outboxDraft());
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(0);
    stop();
    connectivity.setOnline(true);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(create).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('schedules a replay when a draft is queued while it is idle', async () => {
    const { services, outbox, processor } = setup();
    const create = jest.spyOn(services.repos.memories, 'create');
    const stop = processor.start();
    await jest.advanceTimersByTimeAsync(0);
    await outbox.add(outboxDraft());
    await jest.advanceTimersByTimeAsync(1_999);
    expect(create).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await outbox.list()).toEqual([]);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });
});
