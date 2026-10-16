# Current status — 2026-10-16

The notes below are chronological development records; older limitations may have been superseded. Latest local checks: 22 unit tests, frontend build, desktop tests, and Swift compilation. Accessibility was restored for the current local app. One fixed-text insertion was reported successful by the user. The latest automated native live-input attempt could not read the target field, so live cross-app revisions remain unverified. No real chat messages were sent. Screenshots in the README come from an isolated test profile and synthetic HUD events, not external delivery proof.

---

# 验证记录

日期：2026-10-15，Apple Silicon macOS，本地开发环境。

## 已执行并通过

- `npm run build`：生产前端构建成功。
- `npm test`：8 个行为测试通过，包括标准 WAV 编码/验证、外部地址及重定向拒绝、字典/历史持久化、关闭历史、整理失败保留转写、取消推理、编辑选区与指令分离。
- `npm run test:desktop`：真实 Electron 中检查导航、词典增删、设置保存、本机 URL 限制、悬浮窗无读取/配置权限、renderer 无异常。
- `npm run test:models`：真实 Whisper base 与 Qwen2.5 1.5B 推理，英文测试句识别成功，英译中成功。一次 5 秒短句在模型加载完成后处理约 0.66 秒；仅为单次样例，不是延迟保证。
- `npm run test:recording`：将合成测试语音注入 WebAudio MediaStream，经过实际 AudioWorklet、WAV 编码、本机推理与历史记录；Esc 取消不新增记录。不使用真实麦克风。
- `node tests/packaged.mjs`：打包后的 Voiceleaf.app 启动成功，模型路径指向包内 Resources/models，两套模型服务均就绪。
- `npm run pack`：已生成 `release/mac-arm64/Voiceleaf.app`。
- `npm audit --omit=dev`：本次结果为 0 个生产依赖漏洞；不代表所有开发依赖或整个程序不存在安全问题。

## 修复过的问题

- Electron ESM 顶层等待 app.whenReady 导致启动停滞：改为 whenReady 回调。
- 自动化取到悬浮窗而非主窗口：测试按页面 URL 定位主窗口。
- Chromium fake-audio 开关未给出预期音频：改为测试注入合成 WebAudio MediaStream，明确避免真实麦克风。
- 原生输入位置指纹不能依赖 AXValue 的对象地址：改为坐标、尺寸、选区等值的稳定表示，再做 SHA-256。
- 空录音：增加最低录音时长及静音检查。
- 后台失败：写回无法完成时显示主窗口，保留可复制的结果。

## 源码检查要点

IPC 校验窗口身份及主 frame；悬浮窗仅允许停止/取消/打开主窗；禁用 Node renderer 集成并启用 contextIsolation/sandbox；阻止页面导航与新窗口；录音权限只允许主窗口请求音频；模型服务仅允许回环地址且拒绝重定向；子进程通过固定执行文件和参数数组调用；退出时终止应用自行启动的子进程；历史数据用原子替换文件方式写入。

## 未验证 / 仍有限制

- 当前 macOS 辅助功能未授权，因此真实跨应用粘贴及选区读取未实测。
- 真实麦克风硬件、长录音、嘈杂环境、不同口音、专业领域中文准确率未测。
- 选区编辑的本地模型请求契约已测，但完整“外部应用选区 → 语音修改 → 自动写回”尚未完成原生验证。
- 安装包未经 Developer ID 签名和公证；依赖当前机器的 Homebrew Whisper/llama.cpp 运行环境。
- 本项目是独立实现的本地首版，未覆盖 Typeless 的全部功能或像素级 UI。

## 产物

`artifacts/desktop-results.json`、`local-model-results.json`、`recording-results.json`、`packaged-results.json`、`audit-production.json`、`voiceleaf-ready.png`。

## 实时预览更新

- 单元测试 10 项通过，新增中英文实际差异重建、删除语气词展示和 2.5 秒停顿判定。
- 桌面导航和设置保存通过。
- 注入合成语音的 AudioWorklet 测试通过：结束前浮窗出现部分转录，音频结束后静音自动完成，本地识别与整理完成，原文/结果差异视图显示，取消无新增记录。
- 浮窗验证：不获取焦点、跨桌面、置顶。
- 未替用户发送微信消息；尚未验证真实微信输入和实际麦克风环境下的静音阈值。实时预览为周期快照识别，不是模型逐词流式输出。

## 中文识别与等待时间修复

- 新增 large-v3-turbo Q5，本机下载经过固定 revision 的 Hugging Face LFS SHA-256 校验。
- `artifacts/asr-comparison.json`：Tingting 合成中文样本，base 将“输入框里”转为“输入匡例”，turbo 正确；第二次请求分别为 142ms、1212ms。此为单条合成语音对比，不是用户语音准确率或完整端到端延迟评测。
- 移除整理后的固定 1800ms 阻塞等待；如自动输入成功，先输入，再短暂保留删改浮窗。
- 停顿期间无新语音时不重复提交预览请求；完成后显示“转录完成”和对勾，无加载旋转。
- 10 项单元测试、桌面交互与合成录音流程通过；增加完成浮窗无 spinner 的回归断言。

## 本地安装包签名修复

发现未签名打包输出保留了不完整的上游签名，`codesign --verify --deep --strict` 报资源封装缺失。新增本地 ad-hoc 签名步骤，输入辅助组件和 app bundle 都重新签名；当前安装包通过深度严格校验。该签名不是 Developer ID 签名或公证，系统辅助功能授权仍需单独验证，更新后可能需要重新授权。

## 语音确认 Enter

新增末尾“确认发送”解析及主进程/原生组件双重检查；按 Enter 前核对 PID、输入框指纹和完整文字哈希。测试覆盖命令关闭、否定句、空内容、指令去除、模型输出不可授权、输入框变化、已有草稿、取消和原生层拒绝。未向真实聊天或网页发送任何测试消息，尚需用户在目标软件中确认兼容性。安装包采用本地 ad-hoc 签名，更新可能触发重新授权。

## UX update — 2026-10-16

- Replaced the fixed large HUD with a 400-point-wide compact panel, expanding for a three-line transcript or actionable notice. It remains non-activating and appears at the top of the current display to avoid typical bottom-aligned chat composers.
- Live additions fade in; actual rewrite deletions fade briefly before the final text replaces the diff. Full comparisons remain in the main window. Reduced-motion preferences disable animations.
- Reports target readiness before recording. Permission failure, unreadable focus, non-editable focus, changed application, and changed draft have distinct messages.
- Paste verification compares the native expected full-field hash (including existing content and selected range replacement) with the same focused field after posting Cmd+V. Unverified delivery stays visible and is never reported as inserted.
- Enter remains subject to the existing exact-draft checks. Enter failure does not auto-dismiss the retained result. A successful key event is not proof that the remote message was sent.
- Added bounded HUD sizing IPC, a functioning settings link, and session-scoped global Escape cancellation when registration succeeds.
- Validation: 17 unit tests, desktop HUD-state/navigation tests, synthetic microphone test using the real local models, Swift compilation, production build and bundle signature validation passed.
- Remaining: continuous listening across finalized segments is not implemented; silence still completes the current recording. Live WeChat delivery compatibility remains unverified. No real chat messages were sent by these tests.

## Input delivery diagnosis and recovery

The user confirmed Accessibility was enabled but still reported no insertion. Live UI showed the most recent result was unbound to an external input. End-to-end voice insertion is still not proven.

- Fixed a separate compatibility defect: focused AX elements can be owned by web-content processes. Application-scoped focus is now accepted directly; system-wide fallback checks the focused application PID, not the element PID.
- Added a main-window fixed-text insertion test and a retry action for retained transcripts. Both allow five seconds to click the desired external field, then use the normal fingerprint guard and full-value verification. These actions never press Enter.
- Added a desktop regression verifying that cancellation during the countdown returns to idle without writing history or reaching insertion.
- Swift compilation, production build, 17 unit tests and desktop regressions passed. Actual browser insertion must be observed after the new build receives macOS Accessibility authorization; do not infer success from these tests.

## Live draft mode — 2026-10-16

User explicitly selected direct live revisions in the destination input. `liveInput` defaults to true for dictation with auto-paste enabled. Transcription snapshots include the current session (up to five minutes) so the former rolling 30-second window cannot delete the beginning of a live draft. Preview requests are single-flight, scheduled every 1.2 seconds; inference time contributes additional latency. This is batched local recognition, not token-by-token ASR.

The main process owns a serialized LiveDraft with the initial UTF-16 selected range and verified field fingerprint. Each update replaces only that span, retains prefix/suffix, verifies the resulting full text and caret, and updates the guard. A manual edit/caret change/focus change blocks subsequent revisions, including the final rewrite. Final output replaces the live span rather than appending a duplicate. Preview results never trigger Enter. Escape stops further work and leaves text already inserted.

Native updates use AXSelectedText when available, or range-guarded clipboard paste when the editor only supports AXSelectedTextRange. Unreadable/non-settable fields fall back to final-only insertion with an explicit notice. Universal app compatibility is not claimed.

The main record button now offers a five-second target-selection countdown in live mode; the global shortcut captures the destination before showing the HUD. Added a fixed-text live test (明天 → 明天九点开会 → 明天十点开会。), with no Enter key.

Validation: 22 unit tests, native compilation, production build, desktop countdown/cancellation regressions and synthetic microphone pipeline passed. Unit tests exercise preservation of surrounding text/emoji, ordered revisions, cursor/focus/manual-edit interference, cancellation and native refusal. Native cross-app live revisions still require real UI verification after authorization of the new signed bundle.
