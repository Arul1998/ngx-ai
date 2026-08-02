# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-02

### Added

- `provideNgxAi()` standalone provider with `openai`, `grok`, and `custom` presets.
- `NgxAiChatService` with:
  - `chat()` — single, complete chat completion.
  - `complete()` — convenience wrapper emitting just the text.
  - `stream()` — token-by-token streaming over server-sent events, cancellable
    via unsubscribe or an `AbortSignal`.
- Strongly-typed models: `ChatMessage`, `ChatCompletionOptions`,
  `ChatCompletionResponse`, `ChatStreamChunk`, `TokenUsage`.
- Safety guard that refuses to ship an API key to the browser unless
  `dangerouslyAllowBrowserApiKey` is set.
- Unit test suite covering config resolution and request/response mapping.

[0.1.0]: https://github.com/arul1998/ngx-ai/releases/tag/v0.1.0
