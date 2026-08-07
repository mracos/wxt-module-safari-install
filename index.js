import { defineWxtModule } from 'wxt/modules';
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';

const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister';

// Find the single *.xcodeproj under root, skipping build-output dirs.
function findXcodeproj(root) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.endsWith('.xcodeproj')) return join(dir, e.name);
      if (e.name !== 'DerivedData' && e.name !== 'build') stack.push(join(dir, e.name));
    }
  }
  return null;
}

function findApp(dir, name) {
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name === `${name}.app`) return join(dir, e.name);
    }
  } catch {
    /* no such dir */
  }
  return null;
}

/**
 * Runs on `build:done` for the Safari target only. Must be listed AFTER
 * wxt-module-safari-xcode so the Xcode project exists.
 *
 * @type {import('wxt').WxtModule<import('./index.d.ts').SafariInstallOptions>}
 */
export default defineWxtModule({
  name: 'safari-install',
  configKey: 'safariInstall',
  setup(wxt, options) {
    if (wxt.config.browser !== 'safari') return;

    const opts = options ?? {};
    const sign = process.env.WXT_SAFARI_SIGN ?? opts.sign ?? 'auto';
    const install = process.env.WXT_SAFARI_NO_INSTALL ? false : (opts.install ?? true);
    const team = opts.team;

    wxt.hook('build:done', async (wxt2) => {
      const log = wxt2.logger;
      if (process.platform !== 'darwin') {
        throw new Error('safari-install requires macOS.');
      }

      const xcproj = findXcodeproj(resolve(wxt2.config.root, '.output'));
      if (!xcproj) {
        log.warn(
          'safari-install: no .xcodeproj under .output (list this module AFTER wxt-module-safari-xcode).',
        );
        return;
      }
      const projDir = dirname(xcproj);
      const appName = basename(xcproj, '.xcodeproj');
      const derived = join(projDir, 'DerivedData');

      const scheme = JSON.parse(
        execFileSync('xcodebuild', ['-list', '-project', xcproj, '-json'], { encoding: 'utf8' }),
      ).project.schemes[0];

      log.info(`safari-install: building + signing (${sign}, scheme ${scheme})`);
      const args = [
        '-project',
        xcproj,
        '-scheme',
        scheme,
        '-configuration',
        'Release',
        '-derivedDataPath',
        derived,
      ];
      if (sign === 'adhoc') {
        args.push(
          'CODE_SIGN_STYLE=Manual',
          'CODE_SIGN_IDENTITY=-',
          'DEVELOPMENT_TEAM=',
          'PROVISIONING_PROFILE_SPECIFIER=',
        );
      } else {
        args.push('-allowProvisioningUpdates', 'CODE_SIGN_STYLE=Automatic');
        if (team) args.push(`DEVELOPMENT_TEAM=${team}`);
      }
      args.push('build');
      execFileSync('xcodebuild', args, { stdio: 'inherit' });

      const app = findApp(join(derived, 'Build/Products/Release'), appName);
      if (!app) {
        log.warn('safari-install: built app not found; skipping install.');
        return;
      }
      log.success(`safari-install: built ${app}`);

      if (!install) return;
      const dest = `/Applications/${appName}.app`;
      rmSync(dest, { recursive: true, force: true });
      cpSync(app, dest, { recursive: true });
      // xcodebuild registers the DerivedData copy too; drop it so Safari lists one.
      try {
        execFileSync(LSREGISTER, ['-u', app]);
      } catch {
        /* best effort */
      }
      execFileSync('open', [dest]);
      log.success(
        `safari-install: installed ${dest}. Enable it in Safari > Settings > Extensions.`,
      );
      if (sign === 'adhoc') {
        log.info('Ad-hoc build: also Safari > Develop > Allow Unsigned Extensions.');
      }
    });
  },
});
