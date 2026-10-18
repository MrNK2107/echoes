import { AudioModule, setAudioModeAsync } from 'expo-audio';

import { expoAudioRecorder } from './expoAudio';

type Fake = {
  currentTime: number;
  uri: string | null;
  prepareToRecordAsync: jest.Mock;
  record: jest.Mock;
  stop: jest.Mock;
  release: jest.Mock;
};

const made: Fake[] = [];
// eslint-disable-next-line import/namespace
const ctor = AudioModule.AudioRecorder as unknown as jest.Mock;

beforeEach(() => {
  made.length = 0;
  jest.clearAllMocks();
  (setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);
  ctor.mockImplementation(() => {
    const f: Fake = {
      currentTime: 1.5,
      uri: 'file:///r.m4a',
      prepareToRecordAsync: jest.fn(async () => {}),
      record: jest.fn(),
      stop: jest.fn(async () => {}),
      release: jest.fn(),
    };
    made.push(f);
    return f;
  });
});

afterEach(async () => {
  await expoAudioRecorder.stop().catch(() => {});
});

describe('expoAudioRecorder lifecycle', () => {
  it('a second start while recording constructs no second recorder', async () => {
    await expoAudioRecorder.start();
    await expoAudioRecorder.start();
    expect(made).toHaveLength(1);
    await expect(expoAudioRecorder.stop()).resolves.toEqual({ uri: 'file:///r.m4a', durationMs: 1500 });
    expect(made[0].release).toHaveBeenCalledTimes(1);
  });

  it('releases, resets audio mode and allows retry when record() throws', async () => {
    ctor.mockImplementationOnce(() => {
      const f: Fake = {
        currentTime: 0,
        uri: null,
        prepareToRecordAsync: jest.fn(async () => {}),
        record: jest.fn(() => {
          throw new Error('boom');
        }),
        stop: jest.fn(),
        release: jest.fn(),
      };
      made.push(f);
      return f;
    });
    await expect(expoAudioRecorder.start()).rejects.toThrow('boom');
    expect(made[0].release).toHaveBeenCalledTimes(1);
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    await expoAudioRecorder.start();
    expect(made).toHaveLength(2);
    expect(made[1].record).toHaveBeenCalled();
  });

  it('still releases when stop() throws', async () => {
    await expoAudioRecorder.start();
    made[0].stop.mockRejectedValueOnce(new Error('stop failed'));
    await expect(expoAudioRecorder.stop()).rejects.toThrow('stop failed');
    expect(made[0].release).toHaveBeenCalledTimes(1);
    await expect(expoAudioRecorder.stop()).resolves.toBeNull();
  });
});
