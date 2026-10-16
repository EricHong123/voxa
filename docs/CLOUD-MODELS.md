# 本地与云端模型 / Local and cloud models

Voxa 0.2.0 keeps local Whisper + local text cleanup as the default. Cloud services are optional and require your own API account, key, available model and quota. Protocol tests use mocked responses; provider availability and actual recognition quality require testing with your account.

## 如何配置

1. 打开「设置 → 模型服务」，分别选择识别服务、文字服务。
2. 选择服务商预设，或编辑 HTTPS Base URL。填写控制台提供的模型 ID；豆包可使用推理接入点 ID。这里填写 API 地址，不是聊天网站地址。
3. 输入 API Key，点「保存密钥」。语音和文字服务分别保存，密钥不会显示回来。
4. 点「测试连接」。文字测试只发送固定示例；语音测试发送生成的 1 秒静音，不打开麦克风。测试可能产生少量费用。静音被某些服务拒绝时，也可能需要使用实际语音进行验证。
5. 点页面顶部「保存设置」。选择本地服务并保存即可切回本地。

推荐组合：本地 Whisper 识别 + 任选云端文字整理。这样保留本地实时预览，同时只把文字发送给云端。

## 国内服务商

| 预设 | Base URL | 本版用途 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | 文字 |
| 通义千问 / 百炼（北京） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 文字 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | 文字 |
| 月之暗面 Kimi | `https://api.moonshot.cn/v1` | 文字 |
| 豆包 / 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | 文字 |
| 硅基流动 | `https://api.siliconflow.cn/v1` | 语音、文字 |
| MiniMax 国内 | `https://api.minimax.cn/v1` | 文字 |

国内语音预设提供硅基流动 `FunAudioLLM/SenseVoiceSmall`；可改成该平台支持的其他语音模型。本版没有适配阿里云/火山的专用实时语音 WebSocket 协议，不能把它们的文字接口当成语音接口。百炼、Kimi、MiniMax 等国内/海外账户的地址和密钥可能不同，请与控制台保持一致。Coding Plan 不等同于通用 API 额度或端点。

## 国际与自定义服务

OpenAI and Groq support the multipart audio-transcription protocol; OpenAI-compatible chat providers (including OpenRouter), Claude Messages and Gemini Generate Content are supported for text. Model IDs remain editable because availability changes by account and region. Custom endpoints must implement the selected protocol, require HTTPS, and cannot embed keys in URL parameters. Redirects are rejected so credentials are not forwarded to another destination.

## Privacy, keys and limits

- Local mode sends no audio/text to cloud inference services. A separately configured local backend can have its own network behavior.
- Cloud recognition uploads the completed recording once, plus optional language/dictionary hints when supported. Cloud recognition does **not** provide live preview; no repeated rolling-window uploads. Maximum recording length remains five minutes.
- Cloud cleanup sends the transcript and dictionary. Translation sends its target language; editing also sends selected text. These are governed by the chosen provider's policies and billing.
- Keys are encrypted in `credentials.enc.json` using Electron `safeStorage`, with its encryption key protected by macOS Keychain. Keys never enter `state.json`, history, renderer read responses or the repository. They are bound to service type, protocol and normalized Base URL. Removing a key affects only that destination.
- A changed/unsigned application identity may trigger Keychain authorization. If secure storage is unavailable, Voxa fails rather than saving plaintext. Re-enter keys after moving profiles to another Mac.
- Connection tests are explicit requests, not background polling. A successful test is not a guarantee for every model, quota or future request. Failed cleanup retains original transcription and does not authorize automatic submission.

## Official references (checked 2026-10-16)

[DeepSeek](https://api-docs.deepseek.com/) · [百炼地址](https://help.aliyun.com/zh/model-studio/base-url) · [智谱](https://docs.bigmodel.cn/cn/best-practice/case/ai-search-engine) · [Kimi](https://www.kimi.com/help/kimi-api/api-troubleshooting) · [火山方舟](https://docs.volcengine.com/docs/ark/context-management?lang=zh) · [硅基流动语音](https://docs.siliconflow.cn/docs/api/audio-transcriptions-post) · [MiniMax](https://platform.minimax.cn/docs/api-reference/text-openai-api) · [Claude](https://platform.claude.com/docs/en/api/messages/create) · [Gemini](https://ai.google.dev/api/generate-content) · [Groq](https://console.groq.com/docs/overview) · [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
