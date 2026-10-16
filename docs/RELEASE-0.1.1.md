# Voxa 0.1.1 Alpha — self-contained Mac installer

## Download / 下载

Choose **Voxa-0.1.1-macOS26-AppleSilicon.dmg** below. This build is for **M-series Macs running macOS 26 or newer**. Intel Macs and older macOS versions are not supported.

打开 DMG，把 **Voxa.app 拖入 Applications（应用程序）**，复制完成后再启动。模型和运行程序已内置，无需 Homebrew、Node.js、API Key 或单独下载模型。首次使用仍需允许麦克风和辅助功能权限。

Open the DMG, drag Voxa into Applications, and launch it there. Both inference servers and models are included. Allow about 4 GB of free space for the downloaded image and installed app together. Model loading may take time on first launch.

## Included

- Whisper large-v3-turbo Q5 recognition and Qwen2.5 1.5B Instruct Q4 text cleanup.
- Standalone, statically built whisper.cpp and llama.cpp servers with embedded Metal support. No Homebrew runtime dependency.
- Local dictation, optional cleanup/translation/editing, floating transcript panel, dictionary/history, and experimental guarded live input.
- Runtime/model licenses, pinned source provenance and checksum-verified model files.

## Important before installing

**Ad-hoc signed, not Apple Developer ID signed or notarized.** macOS may block first launch. Review the publisher/source and follow [Apple's supported guidance](https://support.apple.com/en-us/102445) if you decide to trust this alpha. Do not disable Gatekeeper or SIP. Managed Macs may disallow it.

Current validation is on an M5 / 24 GB Mac. Native input compatibility remains experimental; a successful installation does not guarantee live input in every app. Existing profiles retain their settings and may need current model paths selected after moving the app. Updating an ad-hoc build may require reauthorizing Accessibility.

## Verification

25 behavior tests, frontend build, native bridge compilation, desktop regression tests, and packaged-model inference checks. Package checks use a fresh profile, isolated ports, system-only PATH, bundled model paths, and synthetic audio. This is not a separate clean-Mac test or real-microphone accuracy benchmark.

The accompanying `SHA256SUMS.txt` lets you check the download:

```sh
shasum -a 256 -c SHA256SUMS.txt
```

Run that command with both downloaded files in the same directory.

[Installation details](https://github.com/EricHong123/voxa/blob/main/docs/INSTALL-MAC.md) · [Input troubleshooting](https://github.com/EricHong123/voxa/blob/main/docs/TROUBLESHOOTING.md)
