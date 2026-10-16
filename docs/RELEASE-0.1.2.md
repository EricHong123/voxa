# Voxa 0.1.2 Alpha — Motion edition

黑白界面动效升级 / A livelier monochrome interface.

- 弹簧导航与模式切换、页面渐入、卡片悬停高光。
- 录音按钮按压反馈、随真实麦克风音量变化的双层光环。
- 浮窗录音节奏条、识别与整理流光、成功勾选描画。
- 遵循 macOS「减少动态效果」，停止与取消立即响应。
- README 新增示例浮窗动图；示例不代表实测识别速度。

Download `Voxa-0.1.2-macOS26-AppleSilicon.dmg`, open it, and drag Voxa to Applications. Includes local Whisper/Qwen models and inference runtimes; no Homebrew or Node required. Apple Silicon, macOS 26 or newer only. Compare the download with `SHA256SUMS.txt`.

This is an experimental alpha, ad-hoc signed and **not Apple notarized**. See [installation instructions](https://github.com/EricHong123/voxa/blob/main/docs/INSTALL-MAC.md) for first launch and microphone/Accessibility permissions. Updating an ad-hoc signed build may require reauthorizing Accessibility. Input support still varies by app; this UI update does not establish universal compatibility.

Validation: 25 behavior tests; Electron desktop workflow; reduced-motion and keyboard checks; release workflow verifies bundled transcription and rewriting on a fresh Apple Silicon runner before upload.
