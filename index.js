import { defineWxtModule } from 'wxt/modules';
import { execFileSync } from 'node:child_process';
import { rmSync, cpSync, mkdtempSync, symlinkSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { LSREGISTER, findApp, findXcodeproj, resolveOptions, xcodebuildArgs } from './lib.js';

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

    const { sign, install, dmg, team, deploymentTarget } = resolveOptions(options);

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
      execFileSync(
        'xcodebuild',
        xcodebuildArgs({ xcproj, scheme, derived, sign, team, deploymentTarget }),
        {
          stdio: 'inherit',
        },
      );

      const app = findApp(join(derived, 'Build/Products/Release'), appName);
      if (!app) {
        log.warn('safari-install: built app not found; skipping install.');
        return;
      }
      log.success(`safari-install: built ${app}`);

      if (dmg) {
        const out = join(wxt2.config.root, '.output', `${appName}.dmg`);
        const stage = mkdtempSync(join(tmpdir(), 'wxt-safari-dmg-'));
        cpSync(app, join(stage, `${appName}.app`), { recursive: true });
        symlinkSync('/Applications', join(stage, 'Applications')); // drag-to-install
        rmSync(out, { force: true });
        // prettier-ignore
        execFileSync('hdiutil', ['create', '-volname', appName, '-srcfolder', stage, '-ov', '-format', 'UDZO', out], { stdio: 'inherit' });
        rmSync(stage, { recursive: true, force: true });
        log.success(`safari-install: packaged ${out}`);
      }

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
