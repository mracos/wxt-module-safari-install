import type { WxtModule } from 'wxt';

export interface SafariInstallOptions {
  /** Apple Developer team ID for `auto` signing. Overrides env. */
  team?: string;
  /**
   * `auto` uses `-allowProvisioningUpdates` + your team (survives Safari
   * restarts; needs your Apple ID in Xcode). `adhoc` signs locally (always
   * builds; needs Safari > Develop > Allow Unsigned Extensions).
   * Overridable with `WXT_SAFARI_SIGN`.
   * @default 'auto'
   */
  sign?: 'auto' | 'adhoc';
  /**
   * Copy the built app to /Applications and launch it. Off by default (a build
   * shouldn't touch /Applications); enable with `WXT_SAFARI_INSTALL=1`.
   * @default false
   */
  install?: boolean;
  /**
   * Also package the built app into `.output/<name>.dmg` (unsigned unless the
   * app is signed). Enable with `WXT_SAFARI_DMG=1`.
   * @default false
   */
  dmg?: boolean;
}

declare const _default: WxtModule<SafariInstallOptions>;
export default _default;
