# Contributing to Voxa

Start with the [README](README.md) and [roadmap](docs/ROADMAP.md). Small compatibility fixes, reproducible bug reports, and accessibility improvements are especially welcome.

## Structure

- `electron/main.mjs`: desktop lifecycle, IPC, local processes, input delivery coordination.
- `electron/core.mjs`: settings, history, local inference contracts.
- `electron/live-draft.mjs`: serialized draft replacement and interference guards.
- `electron/delivery.mjs`: target validation and optional Enter checks.
- `native/Bridge.swift`: macOS Accessibility and input bridge.
- `src/`: React interface, floating HUD, audio capture, revision rendering.
- `tests/`: behavior tests and desktop/model integration tests.

Run `npm ci`, `npm test`, `npm run build`, and on macOS `npm run native` and `npm run test:desktop`. Desktop tests use a temporary profile. Model tests require running local backends and a synthetic fixture:

```sh
mkdir -p artifacts
say -o artifacts/test-speech.aiff 'Hello. This is a local voice recognition test. Please send the project update tomorrow morning.'
ffmpeg -y -i artifacts/test-speech.aiff -ar 16000 -ac 1 -c:a pcm_s16le -map_metadata -1 -fflags +bitexact artifacts/test-speech.wav
npm run test:models
npm run test:recording
```

Install ffmpeg separately if needed. Use a standard 44-byte-header, mono 16 kHz PCM WAV. Synthetic audio tests do not validate a real microphone or external input delivery.

## Pull requests

Explain the concrete problem, resulting behavior, tests, and any remaining compatibility limits. Add behavioral tests for input mutations, cancellation, or command parsing. Preserve context isolation, loopback-only endpoints, explicit voice-to-Enter opt-in, and target verification. Test native delivery only in disposable fields; do not send real messages.

Do not commit models, compiled bundles, private transcripts, profiles, logs, credentials, or extracted third-party source/assets. Contributions should be your own work or have compatible licensing. New dependencies must document their licenses.
