import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GENERIC_ERROR, REPORT_DUPLICATE, REPORT_RATE } from '@/data/errors';
import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { REPORT_NOTE_MAX, REPORT_REASONS, ReportSheet } from './ReportSheet';

const onClose = jest.fn();
const onReported = jest.fn();

async function setup(services: Services = testServices(), target: ComponentProps<typeof ReportSheet>['target'] = { type: 'memory', id: 'memory-1' }) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <ReportSheet visible target={target} onClose={onClose} onReported={onReported} />
    </ServicesProvider>,
  );
  return services;
}

beforeEach(() => {
  jest.restoreAllMocks();
  onClose.mockClear();
  onReported.mockClear();
});

describe('ReportSheet', () => {
  it('offers the six reasons as a radio group, unchecked, with Send report disabled', async () => {
    await setup();
    expect(screen.getByRole('header', { name: 'Why are you reporting this?' })).toBeOnTheScreen();
    // The group stays non-`accessible` so its radios remain individually focusable on iOS, which
    // also means RNTL's getByRole does not match it; check the role on the labelled container.
    expect(screen.getByLabelText('Why are you reporting this?').props.accessibilityRole).toBe('radiogroup');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual([
      'Spam',
      'Harassment or bullying',
      'Hate speech',
      'Sexual content',
      'Violence or threats',
      'Something else',
    ]);
    radios.forEach((r) => expect(r).not.toBeChecked());
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    expect(REPORT_REASONS.map((r) => r.value)).toEqual(['spam', 'harassment', 'hate', 'sexual', 'violence', 'other']);
  });

  it('checks one reason at a time', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    expect(screen.getByRole('radio', { name: 'Spam' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Hate speech' }));
    expect(screen.getByRole('radio', { name: 'Hate speech' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Spam' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Send report' })).toBeEnabled();
  });

  it('sends the reason and the trimmed note, then reports success', async () => {
    const services = testServices();
    const report = jest.spyOn(services.repos.safety, 'reportMemory');
    await setup(services);
    await fireEvent.press(screen.getByRole('radio', { name: 'Harassment or bullying' }));
    const note = screen.getByPlaceholderText('Add details (optional)');
    expect(note.props.maxLength).toBe(REPORT_NOTE_MAX);
    expect(REPORT_NOTE_MAX).toBe(280);
    await fireEvent.changeText(note, '  Keeps posting about me  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(onReported).toHaveBeenCalledTimes(1));
    expect(report).toHaveBeenCalledWith({ memoryId: 'memory-1', reason: 'harassment', note: 'Keeps posting about me' });
  });

  it('sends a null note when none was given', async () => {
    const services = testServices();
    const report = jest.spyOn(services.repos.safety, 'reportMemory');
    await setup(services);
    await fireEvent.press(screen.getByRole('radio', { name: 'Something else' }));
    await fireEvent.changeText(screen.getByPlaceholderText('Add details (optional)'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(onReported).toHaveBeenCalled());
    expect(report).toHaveBeenCalledWith({ memoryId: 'memory-1', reason: 'other', note: null });
  });

  it('shows the duplicate copy for a second report of the same memory', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
      await services.repos.safety.reportMemory({ memoryId: 'memory-1', reason: 'spam', note: null });
    });
    await setup(services);
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(REPORT_DUPLICATE);
    expect(onReported).not.toHaveBeenCalled();
  });

  it('shows the rate-limit copy', async () => {
    const services = testServices();
    jest.spyOn(services.repos.safety, 'reportMemory').mockRejectedValue(new Error(REPORT_RATE));
    await setup(services);
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(REPORT_RATE);
    expect(onReported).not.toHaveBeenCalled();
  });

  it('shows generic copy for an unexpected failure', async () => {
    const services = testServices();
    jest.spyOn(services.repos.safety, 'reportMemory').mockRejectedValue(new TypeError(''));
    await setup(services);
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
  });

  it('Cancel closes without reporting', async () => {
    const services = testServices();
    const report = jest.spyOn(services.repos.safety, 'reportMemory');
    await setup(services);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a community through reportContent and never through reportMemory', async () => {
    const services = testServices();
    const content = jest.spyOn(services.repos.safety, 'reportContent');
    const memory = jest.spyOn(services.repos.safety, 'reportMemory');
    await setup(services, { type: 'community', id: 'community-cubbon-walkers' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(onReported).toHaveBeenCalledTimes(1));
    expect(content).toHaveBeenCalledWith({
      targetType: 'community',
      targetId: 'community-cubbon-walkers',
      reason: 'spam',
      note: null,
    });
    expect(memory).not.toHaveBeenCalled();
  });

  it('reports a profile and shows the duplicate copy the second time', async () => {
    const services = testServices();
    const content = jest.spyOn(services.repos.safety, 'reportContent');
    await setup(services, { type: 'profile', id: 'user-asha' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Harassment or bullying' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(onReported).toHaveBeenCalledTimes(1));
    expect(content).toHaveBeenCalledWith({ targetType: 'profile', targetId: 'user-asha', reason: 'harassment', note: null });
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already reported this.');
    expect(onReported).toHaveBeenCalledTimes(1);
  });

  it('ignores a second Send report while one is in flight', async () => {
    const services = testServices();
    let release!: () => void;
    const content = jest
      .spyOn(services.repos.safety, 'reportContent')
      .mockImplementation(() => new Promise<void>((r) => (release = r)));
    await setup(services, { type: 'community', id: 'community-cubbon-walkers' });
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    const send = screen.getByRole('button', { name: 'Send report' });
    await fireEvent.press(send);
    await act(async () => {
      (send.props.onClick as () => void)();
    });
    expect(content).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });
});
