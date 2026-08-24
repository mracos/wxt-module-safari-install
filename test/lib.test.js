import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  DEFAULT_DEPLOYMENT_TARGET,
  findApp,
  findXcodeproj,
  resolveOptions,
  xcodebuildArgs,
} from '../lib.js';

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Build a throwaway directory tree; every path is created as a directory. */
function tree(...dirs) {
  const root = mkdtempSync(join(tmpdir(), 'safari-install-test-'));
  roots.push(root);
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  return root;
}

test('findXcodeproj finds a nested project', () => {
  const root = tree('Milheiro/Milheiro.xcodeproj');

  assert.equal(findXcodeproj(root), join(root, 'Milheiro/Milheiro.xcodeproj'));
});

test('findXcodeproj skips build-output directories', () => {
  const root = tree('DerivedData/Stale.xcodeproj', 'build/Old.xcodeproj');

  assert.equal(findXcodeproj(root), null);
});

test('findXcodeproj returns null when there is no project', () => {
  const root = tree('Milheiro/Resources');

  assert.equal(findXcodeproj(root), null);
});

test('findXcodeproj returns null for a missing root', () => {
  assert.equal(findXcodeproj(join(tmpdir(), 'safari-install-does-not-exist')), null);
});

test('findApp finds the app bundle by name', () => {
  const root = tree('Milheiro.app');

  assert.equal(findApp(root, 'Milheiro'), join(root, 'Milheiro.app'));
});

test('findApp ignores a different app and a same-named file', () => {
  const root = tree('Other.app');
  writeFileSync(join(root, 'Milheiro.app'), '');

  assert.equal(findApp(root, 'Milheiro'), null);
});

test('findApp returns null for a missing directory', () => {
  assert.equal(findApp(join(tmpdir(), 'safari-install-does-not-exist'), 'Milheiro'), null);
});

test('resolveOptions falls back to defaults', () => {
  const resolved = resolveOptions({}, {});

  assert.deepEqual(resolved, {
    team: undefined,
    sign: 'auto',
    install: false,
    dmg: false,
    deploymentTarget: DEFAULT_DEPLOYMENT_TARGET,
  });
});

test('resolveOptions takes config over defaults', () => {
  const resolved = resolveOptions(
    { team: 'ABC1234567', sign: 'adhoc', install: true, dmg: true, deploymentTarget: '13.0' },
    {},
  );

  assert.deepEqual(resolved, {
    team: 'ABC1234567',
    sign: 'adhoc',
    install: true,
    dmg: true,
    deploymentTarget: '13.0',
  });
});

test('resolveOptions takes env over config', () => {
  const resolved = resolveOptions(
    { sign: 'auto', install: false, dmg: false, deploymentTarget: '13.0' },
    {
      WXT_SAFARI_SIGN: 'adhoc',
      WXT_SAFARI_INSTALL: '1',
      WXT_SAFARI_DMG: '1',
      WXT_SAFARI_DEPLOYMENT_TARGET: '11.0',
    },
  );

  assert.equal(resolved.sign, 'adhoc');
  assert.equal(resolved.install, true);
  assert.equal(resolved.dmg, true);
  assert.equal(resolved.deploymentTarget, '11.0');
});

test('resolveOptions treats 0 and false as an explicit off-switch', () => {
  const off = resolveOptions(
    { install: true, dmg: true },
    {
      WXT_SAFARI_INSTALL: '0',
      WXT_SAFARI_DMG: 'false',
    },
  );

  assert.equal(off.install, false);
  assert.equal(off.dmg, false);
});

test('resolveOptions ignores an empty env var and defers to config', () => {
  const resolved = resolveOptions({ install: true }, { WXT_SAFARI_INSTALL: '' });

  assert.equal(resolved.install, true);
});

const base = {
  xcproj: '/out/Milheiro/Milheiro.xcodeproj',
  scheme: 'Milheiro (macOS)',
  derived: '/out/Milheiro/DerivedData',
  deploymentTarget: '11.0',
};

test('xcodebuildArgs passes the project, scheme, and Release configuration', () => {
  const args = xcodebuildArgs({ ...base, sign: 'auto' });

  assert.deepEqual(args.slice(0, 8), [
    '-project',
    base.xcproj,
    '-scheme',
    base.scheme,
    '-configuration',
    'Release',
    '-derivedDataPath',
    base.derived,
  ]);
  assert.ok(args.includes('MACOSX_DEPLOYMENT_TARGET=11.0'));
  assert.equal(args.at(-1), 'build');
});

test('xcodebuildArgs signs automatically with the team when given', () => {
  const args = xcodebuildArgs({ ...base, sign: 'auto', team: 'ABC1234567' });

  assert.ok(args.includes('-allowProvisioningUpdates'));
  assert.ok(args.includes('CODE_SIGN_STYLE=Automatic'));
  assert.ok(args.includes('DEVELOPMENT_TEAM=ABC1234567'));
});

test('xcodebuildArgs omits the team setting when there is no team', () => {
  const args = xcodebuildArgs({ ...base, sign: 'auto' });

  assert.ok(!args.some((a) => a.startsWith('DEVELOPMENT_TEAM=')));
});

test('xcodebuildArgs signs ad-hoc without provisioning', () => {
  const args = xcodebuildArgs({ ...base, sign: 'adhoc', team: 'ABC1234567' });

  assert.ok(!args.includes('-allowProvisioningUpdates'));
  assert.ok(args.includes('CODE_SIGN_STYLE=Manual'));
  assert.ok(args.includes('CODE_SIGN_IDENTITY=-'));
  // A team would send xcodebuild looking for a provisioning profile we don't have.
  assert.ok(args.includes('DEVELOPMENT_TEAM='));
  assert.ok(args.includes('PROVISIONING_PROFILE_SPECIFIER='));
});
