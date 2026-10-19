import type { ConfigContext, ExpoConfig } from 'expo/config';
import appConfig from '../app.config';

const CAMERA =
  'ECHOES uses the camera to attach photos to your memories and to show memories around you in AR.';

function build(env: Record<string, string | undefined> = {}): ExpoConfig {
  const saved = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  Object.entries(env).forEach(([k, v]) => {
    if (v !== undefined) process.env[k] = v;
  });
  try {
    return (appConfig as (c: ConfigContext) => ExpoConfig)({ config: {} } as ConfigContext);
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    else process.env.EXPO_PUBLIC_EAS_PROJECT_ID = saved;
  }
}

function plugin(cfg: ExpoConfig, name: string) {
  return (cfg.plugins ?? []).find((p) => (Array.isArray(p) ? p[0] : p) === name);
}

describe('app.config', () => {
  it('sets app identifiers', () => {
    const cfg = build();
    expect(cfg.android?.package).toBe('com.phantom.echoes');
    expect(cfg.ios?.bundleIdentifier).toBe('com.mrnk2107.echoes');
  });

  it('passes EXPO_PUBLIC_EAS_PROJECT_ID through to extra.eas.projectId', () => {
    expect(build({ EXPO_PUBLIC_EAS_PROJECT_ID: 'abc-123' }).extra?.eas).toEqual({
      projectId: 'abc-123',
    });
  });

  it('omits extra.eas when the project id is missing', () => {
    expect(build().extra?.eas).toBeUndefined();
  });

  it('configures expo-notifications with a colour only', () => {
    const p = plugin(build(), 'expo-notifications') as [string, { color: string }];
    expect(p).toBeDefined();
    expect(p[1]).toEqual({ color: '#58A6FF' });
  });

  it('uses one combined camera string everywhere', () => {
    const cfg = build();
    expect(cfg.ios?.infoPlist?.NSCameraUsageDescription).toBe(CAMERA);
    const picker = plugin(cfg, 'expo-image-picker') as [string, { cameraPermission: string }];
    expect(picker[1].cameraPermission).toBe(CAMERA);
  });

  it('includes the viro plugin only when the package resolves', () => {
    let installed = true;
    try {
      require.resolve('@reactvision/react-viro/package.json');
    } catch {
      installed = false;
    }
    expect(plugin(build(), '@reactvision/react-viro') !== undefined).toBe(installed);
  });

  it('declares camera and notification permissions on Android', () => {
    const perms = build().android?.permissions ?? [];
    expect(perms).toEqual(
      expect.arrayContaining(['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS']),
    );
  });
});
