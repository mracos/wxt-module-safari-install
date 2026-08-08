# wxt-module-safari-install

A WXT module that **builds, signs, and installs** the generated Safari extension
app locally, on `wxt build -b safari`. It's the automated `⌘R`: pairs with
[`wxt-module-safari-xcode`](https://www.npmjs.com/package/wxt-module-safari-xcode)
(which only generates + configures the Xcode project) so a single command takes
you from source to an extension enabled in Safari.

macOS + Xcode Command Line Tools only. Runs exclusively on the Safari target, so
it's a no-op for Chrome/Firefox builds and in CI.

## Usage

```ts
// wxt.config.ts
export default defineConfig({
  // safari-install MUST come after safari-xcode (it needs the generated project)
  modules: ['wxt-module-safari-xcode', 'wxt-module-safari-install'],
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

```sh
wxt build -b safari
```

## Options

| Option    | Type                | Default  | Notes                                                               |
| --------- | ------------------- | -------- | ------------------------------------------------------------------- |
| `team`    | `string`            | –        | Apple team ID for `auto` signing.                                   |
| `sign`    | `'auto' \| 'adhoc'` | `'auto'` | `auto`: `-allowProvisioningUpdates` + team. `adhoc`: local signing. |
| `install` | `boolean`           | `true`   | Copy to `/Applications` and launch.                                 |
| `dmg`     | `boolean`           | `false`  | Also package the app into `.output/<name>.dmg`.                     |

Env overrides: `WXT_SAFARI_SIGN=adhoc`, `WXT_SAFARI_NO_INSTALL=1`, `WXT_SAFARI_DMG=1`.

## How it works

On `build:done` (Safari only) it finds the `.xcodeproj` under `.output/`,
detects the scheme, runs `xcodebuild` (Release) with the chosen signing, copies
the `.app` to `/Applications`, unregisters the transient DerivedData copy from
LaunchServices (so Safari doesn't list the extension twice), and opens the app.
Then enable it in Safari → Settings → Extensions.
