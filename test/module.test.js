import test from 'node:test';
import assert from 'node:assert/strict';

import safariInstall from '../index.js';

/** Minimal stand-in for the WXT instance, recording what the module hooks into. */
function fakeWxt(browser) {
  const hooks = [];
  return { hooks, config: { browser, root: '/project' }, hook: (name) => hooks.push(name) };
}

test('the module declares the name and config key WXT resolves it by', () => {
  assert.equal(safariInstall.name, 'safari-install');
  assert.equal(safariInstall.configKey, 'safariInstall');
});

test('setup is a no-op for non-Safari targets', () => {
  for (const browser of ['chrome', 'firefox', 'edge']) {
    const wxt = fakeWxt(browser);

    safariInstall.setup(wxt, {});

    assert.deepEqual(wxt.hooks, [], `expected no hooks for ${browser}`);
  }
});

test('setup hooks into build:done for Safari', () => {
  const wxt = fakeWxt('safari');

  safariInstall.setup(wxt, {});

  assert.deepEqual(wxt.hooks, ['build:done']);
});

test('setup tolerates a missing options object', () => {
  const wxt = fakeWxt('safari');

  safariInstall.setup(wxt, undefined);

  assert.deepEqual(wxt.hooks, ['build:done']);
});
