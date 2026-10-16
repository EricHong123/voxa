# Product roadmap / 产品优化路线图

These are planned improvements, not shipped features or delivery promises.

| Priority | Improvement | Acceptance evidence |
| --- | --- | --- |
| P0 | 输入可靠性：清晰的目标名称、可恢复的输入框选择、普通 textarea / contenteditable / 原生文本框兼容性矩阵 | 在目标 App 中记录追加、修正、手动编辑暂停和焦点变化结果；不以浮窗有字代替成功 |
| P0 | 首次启动向导：模型、麦克风、辅助功能、固定文字自检四步 | 新机器用户完成首次输入，不依赖开发者口头解释 |
| P0 | Developer ID 签名、公证、稳定安装路径与更新流程 | 更新后权限行为可复现；给出明确恢复指引 |
| P1 | 真正流式 ASR 或稳定前缀与可修改尾段 | 对中文/中英混说公开首字、修正、结束到完成的 p50/p95 延迟 |
| P1 | 神经 VAD、连续听写、可调停顿时长 | 轻声和长停顿不随意截断，完成一段后能继续下一段 |
| P1 | 可撤销的本轮改写与命令确认 UI | 只撤销 Voxa 自己的范围；手动改字后不覆盖用户内容 |
| P1 | 下载校验、断点续传、体积与预计下载量提示 | 固定 revision + SHA-256 验证，损坏模型不可启动 |
| P2 | 英文 UI、快捷键录制、按住说话/切换模式 | 中英文无硬编码遗漏，快捷键冲突有反馈 |
| P2 | 应用级表达偏好、专业词典导入 | 用户可关闭；不暗中读取无关上下文 |

## Shipping and growth

1. **可靠性先于宣称。** 先公布几个已验证输入框，再逐步扩大兼容性；不写“所有软件都能用”。
2. **30 秒真实演示。** 使用空白测试页面，展示启动、边说边填入、纠错、取消；标明设备、模型与真实时间。当前 README 截图只说明 UI。
3. **搜索入口自然出现。** README 标题、仓库描述和 Topics 使用 Typeless alternative、local dictation、Whisper、macOS；中文页承接“Typeless 开源替代版”“本地语音输入”。
4. **反馈可以复现。** 兼容性 Issue 模板收集 App / 版本 / 控件 / 失败阶段，不要求私人聊天或完整诊断日志。
5. **持续发布可验证改进。** 版本说明记录已修复问题和剩余限制，不购买 Star、不虚构用户数或性能数据。

See [launch copy](LAUNCH.md) for reusable, factual announcement drafts. Distribution to external communities is a separate step.
