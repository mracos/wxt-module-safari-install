# wxt-module-safari-install

[![npm](https://img.shields.io/npm/v/wxt-module-safari-install)](https://www.npmjs.com/package/wxt-module-safari-install)
[![ci](https://github.com/mracos/wxt-module-safari-install/actions/workflows/ci.yml/badge.svg)](https://github.com/mracos/wxt-module-safari-install/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/wxt-module-safari-install)](./LICENSE)

A [WXT](https://wxt.dev) module that **builds, signs, and optionally installs**
the generated Safari extension app on `wxt build -b safari`. It's the automated
`⌘R`: pairs with
[`wxt-module-safari-xcode`](https://www.npmjs.com/package/wxt-module-safari-xcode)
(which only generates + configures the Xcode project) so a single command takes
you from source to an extension enabled in Safari.

macOS + Xcode Command Line Tools only. Runs exclusively on the Safari target, so
it's a no-op for Chrome/Firefox builds and in CI.

## Install

```sh
npm i -D wxt-module-safari-install wxt-module-safari-xcode
```

```sh
pnpm add -D wxt-module-safari-install wxt-module-safari-xcode
```

```sh
yarn add -D wxt-module-safari-install wxt-module-safari-xcode
```

Requires Node >= 20 and `wxt` >= 0.19 (a peer dependency, so it uses whichever
WXT your project already has).

## Usage

Add both modules to `wxt.config.ts`. Order matters: `safari-install`
xcodebuilds the project that `safari-xcode` generates, so it must come second.

```ts
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['wxt-module-safari-xcode', 'wxt-module-safari-install'],
  manifest: {
    // The converter names the Xcode project after manifest.name, so keep this
    // equal to safariXcode.projectName.
    name: 'MyApp',
  },
  safariXcode: {
    projectName: 'MyApp',
    appCategory: 'public.app-category.travel',
    bundleIdentifier: 'com.example.MyApp',
    developmentTeam: 'ABC1234567',
    projectType: 'macos',
    openProject: false, // let safari-install do the build+install headlessly
  },
  safariInstall: {
    team: 'ABC1234567',
    sign: 'auto', // or 'adhoc'
  },
});
```

TypeScript picks up the `safariInstall` config key automatically if you have a
`wxt-modules.d.ts` in your project:

```ts
import type { SafariInstallOptions } from 'wxt-module-safari-install';

declare module 'wxt' {
  export interface InlineConfig {
    safariInstall?: SafariInstallOptions;
  }
}
```

Then:

```sh
wxt build -b safari                       # build + sign
WXT_SAFARI_INSTALL=1 wxt build -b safari  # ...and install into /Applications
WXT_SAFARI_DMG=1 wxt build -b safari      # ...and package .output/MyApp.dmg
```

Worth adding to `package.json` scripts, so a plain build stays a plain build:

```json
{
  "scripts": {
    "build:safari": "wxt build -b safari",
    "safari:install": "WXT_SAFARI_INSTALL=1 wxt build -b safari"
  }
}
```

## Options

| Option             | Type                | Default  | Notes                                                               |
| ------------------ | ------------------- | -------- | ------------------------------------------------------------------- |
| `team`             | `string`            | –        | Apple team ID for `auto` signing.                                   |
| `sign`             | `'auto' \| 'adhoc'` | `'auto'` | `auto`: `-allowProvisioningUpdates` + team. `adhoc`: local signing. |
| `install`          | `boolean`           | `false`  | Copy to `/Applications` and launch.                                 |
| `dmg`              | `boolean`           | `false`  | Also package the app into `.output/<name>.dmg`.                     |
| `deploymentTarget` | `string`            | `'11.0'` | Minimum macOS stamped into the app, instead of the build SDK's.     |

Every option has an env override, which wins over the config: `WXT_SAFARI_SIGN`,
`WXT_SAFARI_INSTALL`, `WXT_SAFARI_DMG`, `WXT_SAFARI_DEPLOYMENT_TARGET`. The
boolean ones accept `0` and `false` to force the option off for one run.

### Choosing a signing mode

- **`auto`** needs your Apple ID added to Xcode. The extension survives Safari
  restarts, so it's what you want day to day.
- **`adhoc`** signs locally and needs no Apple account, but Safari only loads it
  with **Develop → Allow Unsigned Extensions** ticked, which resets on restart.
  Good for CI artifacts and for trying the module before setting up an account.

## How it works

On `build:done` (Safari only) it finds the `.xcodeproj` under `.output/`,
detects the scheme, runs `xcodebuild` (Release) with the chosen signing, and,
when `install` is on, copies the `.app` to `/Applications`, unregisters the
transient DerivedData copy from LaunchServices (so Safari doesn't list the
extension twice), and opens the app. Then enable it in Safari → Settings →
Extensions.

`deploymentTarget` exists because the converter-generated project has no
explicit target and inherits the build machine's SDK. On a `macos-latest` runner
that stamps the current macOS into `LSMinimumSystemVersion` and produces an app
that refuses to launch anywhere older.

## Contributing

```sh
npm ci
npm run check   # format + lint + typecheck + tests
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org).
[release-please](https://github.com/googleapis/release-please) reads them and
keeps a draft release PR open with the version bump and changelog; merging it
tags the release and publishes to npm via OIDC trusted publishing.

## License

MIT © [Marcos Ferreira](https://github.com/mracos)
