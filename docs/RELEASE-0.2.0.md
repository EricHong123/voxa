# Voxa 0.2.0 Alpha — Local + cloud models

本地默认，云端可选。语音识别与文字整理可独立配置。

- 国内文字预设：DeepSeek、通义千问 / 百炼、智谱 GLM、Kimi、豆包 / 火山方舟、硅基流动、MiniMax。
- 国内语音：硅基流动兼容语音转录接口，预填 SenseVoiceSmall。
- 国际服务：OpenAI、Groq、OpenRouter、Claude、Gemini；支持自定义 HTTPS Base URL 与模型 ID。
- macOS 钥匙串保护的加密密钥存储、按服务地址隔离密钥、显式连接测试。
- 云端识别在录音结束后上传一次；本地 Whisper + 云端整理保留本地实时预览。
- 云端处理会上传音频或文字，按服务商政策计费与保留数据，默认仍为完全本地模式。

[配置教程、支持范围、数据流](https://github.com/EricHong123/voxa/blob/main/docs/CLOUD-MODELS.md)

Download `Voxa-0.2.0-macOS26-AppleSilicon.dmg`, open it, and drag Voxa into Applications. Includes local models and runtimes. Requires Apple Silicon and macOS 26+. Experimental alpha, ad-hoc signed, not Apple-notarized; updating may require reauthorizing Accessibility or Keychain access.

Validation: 34 behavior tests, Electron desktop and cloud-settings flows, plus bundled local inference in the release workflow. Cloud protocols were tested with synthetic/mock responses; no paid account keys are bundled, and provider-specific live availability must be checked using your own credentials. Specialized Alibaba/Volcengine realtime audio protocols are not included.
