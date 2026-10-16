<div align="center">
<img src="build/icon-1024.png" width="88" alt="Voxa 图标" />

# Voxa — macOS 上的 Typeless 开源替代方案

**开口表达，文字留在你的 Mac。**

本地语音输入 · Whisper 语音识别 · AI 去口头禅 · 黑白悬浮窗

[English](README.md) · [安装](#安装) · [故障排查](docs/TROUBLESHOOTING.md) · [路线图](docs/ROADMAP.md)

</div>

Voxa 是面向 macOS 的本地优先语音输入工具：把口述变成文字，再用本地模型整理语气词、标点与表达。适合正在寻找 **Typeless 开源替代版、Mac 本地语音输入、离线语音转文字** 的开发者和早期体验者。无需 Voxa 账号、订阅或云端 API Key。

> **当前为实验性 Alpha，提供内置模型的 Mac 安装包。** 实时写回依赖目标软件的辅助功能支持，尚未验证所有 App 和网页。它不是 Typeless 官方版本，也不承诺同等准确率、速度或完整功能。

![Voxa 主界面，使用空白测试资料](docs/assets/home.png)

## 能做什么

- **说完即整理**：Whisper 识别，Qwen 本地去口头禅与标点整理；也支持翻译、选中文字后语音编辑。
- **小浮窗看过程**：边说边看转录，整理时展示真实删改差异。
- **边说边填入（实验性）**：输入框支持时，周期性更新本轮草稿，纠错时原位替换，不反复追加整段。
- **个人词典和本地历史**：记住人名、项目名；历史可搜索、复制、删除、导出。
- **明确的暂停保护**：移动光标、手动改字、切换输入位置，会停止继续覆盖。失败时保留文字供复制。
- **可选语音回车**：设置中开启后，末尾说“确认发送”，核对输入框与完整草稿后按一次 Enter；可能发送聊天或提交网页表单。

![浮窗预览，使用合成测试文本](docs/assets/hud-preview.png)

图片展示实际 UI，不代表已通过所有软件的自动填入测试。

## 安装

**[下载 Voxa Mac 安装包（Apple Silicon / macOS 26+）](https://github.com/EricHong123/voxa/releases/download/v0.1.1-alpha.1/Voxa-0.1.1-macOS26-AppleSilicon.dmg)** · [版本说明与 SHA-256](https://github.com/EricHong123/voxa/releases/tag/v0.1.1-alpha.1)

打开 DMG，把 **Voxa.app 拖到“应用程序”**，复制完成后从“应用程序”启动。模型和独立运行程序都已内置，**不需要 Homebrew、Node.js、API Key 或单独下载模型**。下载文件与安装后的 App 合计建议预留约 4 GB 磁盘空间。

本包只支持 M 系列芯片、macOS 26 及以上。当前为 **ad-hoc 签名、未公证的 Alpha**，首次打开可能被 macOS 拦截；请核对来源后参照[安装说明](docs/INSTALL-MAC.md)及 [Apple 官方指引](https://support.apple.com/en-us/102445)操作。开发验证设备是 M5 / 24 GB，不代表最低内存要求。

### 从源码运行

开发者需要 Git、Node.js 22.12+、npm、Homebrew、Xcode Command Line Tools：

```sh
xcode-select --install  # 已安装可跳过
brew install whisper.cpp llama.cpp

git clone https://github.com/EricHong123/voxa.git
cd voxa
npm ci
npm run models
npm run native
npm start
```

源码开发使用 Homebrew 模型服务，模型下载约 1.84 GB。首次安装需联网；默认推理在本机运行。

构建可分发 DMG：

```sh
brew install cmake
npm run package:mac
```

脚本会从固定源码编译独立运行程序，内置 Metal 支持，生成 `release-distribution/Voxa-0.1.1-macOS26-AppleSilicon.dmg`。详见[打包说明](docs/PACKAGING.md)。

## 第一次使用

1. 设置里确认两个模型“已连接”；主要说中文时，把识别语言选为中文。
2. 允许麦克风权限；到系统设置 → 隐私与安全性 → 辅助功能，开启当前 Voxa。
3. 点击目标输入框，按 **⌘⌥空格** 开始说话。已有用户保留原快捷键，设置中可改为 **Control + Z**。
4. 停顿约 2.5 秒自动完成；也可再按快捷键结束。支持的输入框会周期性出现识别文字，结束时再整理本轮草稿。
5. 没填进去时，先点设置里的“测试填入”或“测试实时填入”，5 秒内实际点击目标输入框。仍不支持时复制保留的结果。

点击主窗口录音按钮，也可以倒计时选择目标输入框。按 Escape 取消会停止后续处理，**已经填入的文字会保留**。长思考可以关闭“停顿后自动完成”，每次录音上限 5 分钟。

### 实时，不等于每个字零延迟

当前按约 1.2 秒间隔调度音频快照识别，同一时间只运行一轮；还需加上模型推理时间。它不是模型逐 token 流式解码。长录音会增加计算量，最终还会完整识别并整理一次。

固定文字填入已有一次用户反馈成功；实时改写跨软件兼容性仍待充分验证。单元测试、桌面测试与合成语音测试不等于真实微信或任意网页验证。[查看验证范围](VALIDATION.md)。

## 隐私

- 推理接口仅接受 `http://127.0.0.1:端口`，拒绝外部地址与重定向。自行配置的本地服务可能有自己的联网行为。
- App 不接统计或云同步，不保存原始录音文件。第三方模型服务的日志由服务自身决定。
- 设置、词典和最多 500 条历史为本地**明文**，路径为 `~/Library/Application Support/Voiceleaf/state.json`。旧目录名用于兼容既有数据。
- 关闭历史不删除旧记录，可以在历史页清空。剪贴板填入会改变系统剪贴板内容。
- 密码框和不提供辅助功能文本的控件不支持自动写回。

## 一起把它做可靠

优先解决输入兼容性、首次启动引导、稳定签名和延迟观测。详见[产品路线图](docs/ROADMAP.md)。欢迎提交[兼容性报告](https://github.com/EricHong123/voxa/issues/new?template=compatibility.yml)：App 名称、版本、输入框类型、是否能读到文字、是否发生重复或覆盖。不要上传私人聊天内容。

如果你想要可修改、可本地运行的语音输入工具，欢迎 Star 关注迭代。项目使用 [MIT 许可证](LICENSE)；模型和第三方依赖保留各自许可证，见[第三方说明](THIRD_PARTY_NOTICES.md)。

Voxa 与 [Typeless](https://www.typeless.com/) 无隶属或合作关系。“Typeless 开源替代方案”描述目标工作流，不表示官方开源、源码复刻或效果对等。
