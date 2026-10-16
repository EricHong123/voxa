# 输入与安装故障排查 / Troubleshooting

## 识别了，但没有填进输入框

先看浮窗的具体提示，不要反复重新录音。

1. 在设置确认辅助功能显示“已开启”。系统开关为开不代表当前构建仍获授权。
2. 点击普通文字输入框，而非聊天软件的“按住说话”区域。保持光标在原处，用全局快捷键启动。
3. 点“测试填入”，在 5 秒内亲自点击输入框。测试只填固定文字，不按 Enter。
4. 点“测试实时填入”，观察是否从“明天”变成“明天九点开会”，再改为“明天十点开会。”。
5. 若提示输入位置或文字变化，保留现有内容并复制结果。不要为了强行写入关闭目标检查。
6. 若普通文本框可用而某个 App 不可用，提交兼容性报告。密码框、特殊编辑器、语音消息模式不能等同于普通输入框。

Accessibility automation may visually focus a field without changing the application's native foreground context. A real mouse click is useful when diagnosing target selection. A successful unit test is not proof of native insertion.

## 更新后权限失效

本机开发包使用 ad-hoc 签名，重建可能改变 macOS 识别的代码身份。

1. 退出 Voxa。
2. 系统设置 → 隐私与安全性 → 辅助功能，移除失效的旧 Voxa 条目。
3. 添加你实际运行的 `release/mac-arm64/Voxa.app`，开启权限。
4. 重新打开 Voxa，查看设置里的权限状态，再做固定文字测试。

系统可能要求 Touch ID 或密码。不要公开密码，也不要通过关闭 SIP 或系统安全机制解决授权问题。正式 Developer ID 签名与公证仍在路线图中。

## 模型未连接 / Models unavailable

- Run `npm run models` and confirm the downloads finish.
- Run `command -v whisper-server` and `command -v llama-server`. Install `whisper.cpp` and `llama.cpp` using Homebrew if missing.
- Supported runtime locations are `/opt/homebrew/bin` and `/usr/local/bin`.
- Check the model paths in Settings. Existing profiles can point to an older build; select the files in the current checkout's `models/`, save, then restart.
- Default ports are 17861 and 17862. A different local process occupying these ports can prevent startup.
- `npm run dev` serves the UI only. Use `npm start` for the actual desktop application.

## 很慢、断句过早、中文不准

- 等模型连接完成后再说话；主要中文场景选“中文”，减少语言猜测。
- 关闭“智能整理”可省去听写后的文字模型处理；翻译和编辑仍需要文字模型。
- 加入专有名词到词典，检查麦克风选择，减少背景噪声。
- 长思考时关闭“停顿后自动完成”。当前是音量阈值检测，不是完整神经 VAD。
- 实时模式会反复识别当前会话快照；长录音延迟可能增加。每 1.2 秒调度不等于 1.2 秒内保证出字。
- 取消录音不会撤销已经写进输入框的文字。

## Enter 没有发送

Voice-to-Enter is off by default. Enable it explicitly and end dictation with “确认发送”. Existing surrounding draft text, a changed target, or unverified content prevents Enter. Apps requiring Command+Enter are not handled automatically. A posted Enter key is not confirmation that a server received a message.
