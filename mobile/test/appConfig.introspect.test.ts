import { execSync } from 'node:child_process';

// Runs the real config plugins (introspection) so plugin defaults that add background modes or
// permissions the app does not use are caught, which a unit test of app.config.ts cannot see.
interface Introspected {
  ios?: { infoPlist?: Record<string, unknown> };
  android?: { permissions?: string[]; blockedPermissions?: string[] };
}

function introspect(): Introspected {
  const out = execSync('npx expo config --type introspect --json', {
    cwd: `${__dirname}/..`,
    encoding: 'utf8',
    timeout: 90_000,
    env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' },
  });
  return JSON.parse(out.slice(out.indexOf('{'))) as Introspected;
}

describe('introspected native config (privacy labels must match)', () => {
  const cfg = introspect();
  const plist = cfg.ios?.infoPlist ?? {};
  const perms = cfg.android?.permissions ?? [];

  it('declares no iOS background modes', () => {
    expect(plist.UIBackgroundModes).toBeUndefined();
  });

  it('declares no always-on or motion location usage on iOS', () => {
    expect(plist.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
    expect(plist.NSLocationAlwaysUsageDescription).toBeUndefined();
    expect(plist.NSMotionUsageDescription).toBeUndefined();
  });

  it('requests no foreground-service, background-location or motion permissions on Android', () => {
    expect(perms.filter((p) => /FOREGROUND_SERVICE|ACCESS_BACKGROUND_LOCATION|ACTIVITY_RECOGNITION/.test(p))).toEqual([]);
  });

  it('blocks the overlay permission some dependencies merge in', () => {
    expect(cfg.android?.blockedPermissions).toEqual(
      expect.arrayContaining(['android.permission.SYSTEM_ALERT_WINDOW']),
    );
  });
});
