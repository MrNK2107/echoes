import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { fakeAudioRecorder, testServices } from '@/device/fakes';
import type { AudioRecorderService } from '@/device/types';
import { ServicesProvider } from '@/services/ServicesProvider';

import { MAX_VOICE_SECONDS, VoiceRecorder } from './VoiceRecorder';

type Rec = { uri: string; durationMs: number } | null;

async function setup(audioRecorder: AudioRecorderService, onChange: (r: Rec) => void = () => {}) {
  await render(
    <ServicesProvider services={testServices({ audioRecorder })}>
      <VoiceRecorder onChange={onChange} />
    </ServicesProvider>,
  );
}

describe('VoiceRecorder', () => {
  afterEach(() => jest.useRealTimers());

  it('is 60 seconds max', () => {
    expect(MAX_VOICE_SECONDS).toBe(60);
  });

  it('records, stops and reports the voice note', async () => {
    const onChange = jest.fn();
    await setup(fakeAudioRecorder({ result: { uri: 'file:///v.m4a', durationMs: 4200 } }), onChange);
    await fireEvent.press(screen.getByText('Record voice note'));
    expect(await screen.findByText('Recording 0s / 60s')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Stop'));
    expect(await screen.findByText('Voice note ready (4s)')).toBeOnTheScreen();
    expect(onChange).toHaveBeenLastCalledWith({ uri: 'file:///v.m4a', durationMs: 4200 });
  });

  it('removes the voice note', async () => {
    const onChange = jest.fn();
    await setup(fakeAudioRecorder({ result: { uri: 'file:///v.m4a', durationMs: 4200 } }), onChange);
    await fireEvent.press(screen.getByText('Record voice note'));
    await fireEvent.press(await screen.findByText('Stop'));
    await fireEvent.press(await screen.findByText('Remove voice note'));
    expect(screen.getByText('Record voice note')).toBeOnTheScreen();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('shows the permission copy when the microphone is denied', async () => {
    await setup(fakeAudioRecorder({ permission: 'denied' }));
    await fireEvent.press(screen.getByText('Record voice note'));
    expect(await screen.findByText('Microphone permission is needed for voice notes.')).toBeOnTheScreen();
    expect(screen.getByText('Record voice note')).toBeOnTheScreen();
  });

  it('ignores a recording that produced no file', async () => {
    const onChange = jest.fn();
    await setup(fakeAudioRecorder({ result: null }), onChange);
    await fireEvent.press(screen.getByText('Record voice note'));
    await fireEvent.press(await screen.findByText('Stop'));
    expect(await screen.findByText('Record voice note')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('auto-stops at 60 seconds', async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    await setup(fakeAudioRecorder({ result: { uri: 'file:///v.m4a', durationMs: 60_000 } }), onChange);
    await fireEvent.press(screen.getByText('Record voice note'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByText('Recording 30s / 60s')).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByText('Voice note ready (60s)')).toBeOnTheScreen();
    expect(onChange).toHaveBeenLastCalledWith({ uri: 'file:///v.m4a', durationMs: 60_000 });
  });
});
