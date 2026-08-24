import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LaunchServices' registration tool. xcodebuild registers the DerivedData copy
 * of the app too, so the installed one isn't the only extension Safari sees.
 */
export const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister';

export const DEFAULT_DEPLOYMENT_TARGET = '11.0';

/** Directories that hold build output, never the source project. */
const BUILD_DIRS = new Set(['DerivedData', 'build']);

/**
 * Find the single *.xcodeproj under root, skipping build-output dirs.
 *
 * @param {string} root
 * @returns {string | null}
 */
export function findXcodeproj(root) {
  const stack = [root];
  while (stack.length) {
    const dir = /** @type {string} */ (stack.pop());
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.endsWith('.xcodeproj')) return join(dir, e.name);
      if (!BUILD_DIRS.has(e.name)) stack.push(join(dir, e.name));
    }
  }
  return null;
}

/**
 * @param {string} dir
 * @param {string} name
 * @returns {string | null}
 */
export function findApp(dir, name) {
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
 * Env overrides config, config overrides the default.
 *
 * @param {import('./index.d.ts').SafariInstallOptions} [options]
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveOptions(options = {}, env = process.env) {
  return {
    team: options.team,
    sign: env.WXT_SAFARI_SIGN ?? options.sign ?? 'auto',
    install: env.WXT_SAFARI_INSTALL ? true : (options.install ?? false),
    dmg: env.WXT_SAFARI_DMG ? true : (options.dmg ?? false),
    deploymentTarget:
      env.WXT_SAFARI_DEPLOYMENT_TARGET ?? options.deploymentTarget ?? DEFAULT_DEPLOYMENT_TARGET,
  };
}

/**
 * @param {object} params
 * @param {string} params.xcproj
 * @param {string} params.scheme
 * @param {string} params.derived
 * @param {'auto' | 'adhoc'} params.sign
 * @param {string} [params.team]
 * @param {string} params.deploymentTarget
 * @returns {string[]}
 */
export function xcodebuildArgs({ xcproj, scheme, derived, sign, team, deploymentTarget }) {
  const args = [
    '-project',
    xcproj,
    '-scheme',
    scheme,
    '-configuration',
    'Release',
    '-derivedDataPath',
    derived,
    // The converter-generated project has no explicit target, so it inherits the
    // build machine's SDK. On a macos-latest runner that stamps the current macOS
    // into LSMinimumSystemVersion and locks the app to the newest release.
    `MACOSX_DEPLOYMENT_TARGET=${deploymentTarget}`,
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
  return args;
}
