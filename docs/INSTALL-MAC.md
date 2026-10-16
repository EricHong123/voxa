# Install Voxa / 安装 Voxa

This alpha DMG requires **Apple Silicon (M-series) and macOS 26 or newer**. Intel Macs and older macOS versions are not supported by this build.

1. Download `Voxa-0.1.1-macOS26-AppleSilicon.dmg` from https://github.com/EricHong123/voxa/releases/tag/v0.1.1-alpha.1 .
2. Open the DMG and drag **Voxa.app → Applications**. Wait for copying to finish, then eject the disk image.
3. Launch Voxa from Applications, not from the mounted disk image. Local model loading can take time on first launch.
4. Allow microphone access when asked. For text insertion, enable Voxa in System Settings → Privacy & Security → Accessibility.
5. Click a normal text field, then press **Command + Option + Space**. Existing profiles keep their configured shortcut.

The package includes Whisper large-v3-turbo Q5, Qwen2.5 1.5B Q4, and standalone model servers. **No Homebrew, Node.js, Terminal, or separate model download is required for normal use.** Allow roughly 4 GB of free space for the downloaded DMG and installed app together, plus working memory for inference.

## Signing status

This is an **ad-hoc signed, unnotarized alpha**, not an Apple Developer ID signed release. macOS may block the first launch. Review the source and publisher, then follow Apple's guidance if you choose to trust it: https://support.apple.com/en-us/102445 . Do not disable Gatekeeper or SIP. Managed Macs may prohibit opening it.

This package does not install a background system service, modify system permissions, or request administrator privileges through an installer script. Microphone and Accessibility grants are still yours to authorize. Updating an ad-hoc signed build may require removing the old Accessibility entry, adding the current app, and restarting it.

## 中文

仅支持 **M 系列芯片、macOS 26 及以上**。下载 DMG，打开后把 Voxa 拖到“应用程序”，等待复制结束，再从“应用程序”启动。模型与运行程序已内置，不需要装 Homebrew 或手动下载模型。

当前是未公证 Alpha，首次启动可能被 macOS 拦截；请核对来源，按上方 Apple 官方说明决定是否信任。首次使用需自行允许麦克风和辅助功能。默认快捷键为 ⌘⌥空格，已有配置会保留。

安装包可运行不代表所有输入框都支持实时写回。请先在空白测试文本框验证，失败时复制保留的文字。
