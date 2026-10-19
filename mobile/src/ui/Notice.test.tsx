import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { Notice } from './Notice';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : sources(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('Notice', () => {
  const original = Platform.OS;
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  });
  afterEach(() => {
    announce.mockRestore();
    Platform.OS = original;
  });

  it('renders nothing without a message', async () => {
    await render(<Notice message={null} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('is a polite alert live region', async () => {
    await render(<Notice message="Saved" />);
    const el = screen.getByRole('alert');
    expect(el.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('Saved')).toBeOnTheScreen();
  });

  it('announces on iOS only when the message changes', async () => {
    Platform.OS = 'ios';
    const view = await render(<Notice message="One" />);
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('One');
    await view.rerender(<Notice message="One" tone="error" />);
    expect(announce).toHaveBeenCalledTimes(1);
    await view.rerender(<Notice message="Two" />);
    expect(announce).toHaveBeenLastCalledWith('Two');
    await view.rerender(<Notice message={null} />);
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('relies on the live region on Android', async () => {
    Platform.OS = 'android';
    await render(<Notice message="One" />);
    expect(announce).not.toHaveBeenCalled();
  });

  it('has no raw accessibilityLiveRegion outside Notice', () => {
    const root = join(__dirname, '..', '..');
    const offenders = [...sources(join(root, 'src')), ...sources(join(root, 'app'))].filter(
      (f) => !f.endsWith('Notice.tsx') && readFileSync(f, 'utf8').includes('accessibilityLiveRegion'),
    );
    expect(offenders).toEqual([]);
  });
});
