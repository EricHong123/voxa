# Building the macOS distribution

## Supported output

Apple Silicon / arm64, macOS **26.0+**. Current inference builds explicitly target 26.0 and disable host-specific CPU tuning. Intel and older macOS builds need separate compilation and validation. The current binary has been tested on an M5 / 24 GB Mac; other M-series hardware is not yet independently validated.

## Reproduce

On a macOS 26+ Apple Silicon development machine, install Xcode Command Line Tools, Node.js 22.12+, npm and CMake. Homebrew can provide CMake, but the resulting app does not depend on Homebrew.

```sh
npm ci
npm run models
npm run package:mac
```

Output: `release-distribution/Voxa-0.1.1-macOS26-AppleSilicon.dmg` and `SHA256SUMS.txt`. The app is assembled in `release-distribution/mac-arm64/Voxa.app`. This separate path avoids overwriting a previously authorized local development app.

The build:

1. Downloads pinned whisper.cpp v1.9.4 and llama.cpp commit `7fe450e19305b828c199d602c23a8337aaa1f03b` source archives and checks SHA-256.
2. Builds static servers with embedded Metal support, no OpenMP or OpenSSL dependency, and no dynamic GGML backend loading. `otool -L` must contain only Apple system libraries.
3. Checks SHA-256 for the bundled Whisper large-v3-turbo Q5 and Qwen2.5 1.5B Instruct Q4 models against `licenses/models.json`. The unused base model is omitted.
4. Includes runtime provenance, upstream licenses/vendor notices, model licenses, and Electron's supplied notices.
5. Packages Electron, ad-hoc signs runtime executables, the bridge and the app, then performs strict signature verification.
6. Creates a compressed read-only DMG with Voxa.app, an Applications shortcut and install instructions. Verifies the disk image and writes its SHA-256 checksum. The script refuses assets at or above GitHub's 2 GiB per-file limit.

Build directories and generated runtime binaries are ignored by Git. Source paths in the C/C++ runtime builds are remapped to `/voxa-source`.

## Verification

```sh
npm test
npm run test:desktop
npm run test:package
```

The package integration test requires `artifacts/test-speech.wav`; see CONTRIBUTING.md to generate it. It uses a fresh temporary profile, isolated local ports, a system-only PATH, packaged model paths, and real synthetic-speech inference. It checks that runtime dependencies are system-only and verifies the app signature. It does not validate actual microphone hardware, universal input compatibility, Gatekeeper acceptance, or a separate clean Mac.

Before publishing, inspect the image contents, verify the checksums, and ensure GitHub CI is green for the release commit. Upload DMG and checksum as Release assets, not Git blobs.

## Signing and updates

No Developer ID identity is available in the current build environment. **Ad-hoc signed is not notarized.** Do not describe this artifact as Apple verified or guaranteed to open without warnings. Users decide whether to trust it using Apple's supported flow; do not ship scripts that disable Gatekeeper or clear quarantine automatically.

A production release should use Developer ID signing, hardened runtime with reviewed entitlements, Apple notarization and stapling. This will also require testing stable Accessibility authorization across updates. There is currently no automatic updater.
