# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-08-28

### Added

- **Tool / function calling.** `ChatCompletionOptions` gains `tools` and
  `toolChoice`, mapped to the provider `tools` / `tool_choice` fields.
- New types: `ToolDefinition`, `ToolChoice`, `ToolCall` and `ToolCallDelta`.
- `ChatCompletionResponse.toolCalls` surfaces the assistant's requested calls,
  and streamed `ChatStreamChunk.toolCalls` carries incremental tool-call
  fragments (keyed by `index`).

### Changed

- `ChatMessage.content` is now `string | null` (an assistant message may carry
  only `tool_calls`), and `ChatMessage` gains optional `tool_calls` and
  `tool_call_id` for tool-calling round-trips.

## [0.4.0] - 2026-08-28

### Added

- **`NgxAiChatService.json<T>()`** — request structured output and parse the
  reply into `T`. Defaults `response_format` to `{ type: 'json_object' }`, and
  raises a readable `[ngx-ai]` error instead of a raw `SyntaxError` when the
  model returns invalid JSON.
- **`responseFormat`** option on `ChatCompletionOptions`, mapped to the
  provider `response_format` field (supports `json_object` and `json_schema`).

### Changed

- Internal provider-response mapping is now typed against dedicated
  `OpenAi*` payload interfaces instead of `Record<string, any>`, tightening
  compile-time checks in `chat()` and the streaming parser.

## [0.3.0] - 2026-08-26

### Added

- **`injectAiChat()`** — a signal-backed chat store for Angular components.
  Exposes `messages`, `response`, `loading`, `streaming` and `error` as signals,
  plus `send()`, `stream()`, `abort()` and `reset()` methods. The assistant reply
  updates live while streaming, and in-flight requests are aborted automatically
  when the owning component is destroyed. Accepts an optional `system` prompt and
  initial `messages`.

## [0.2.0] - 2026-08-26

### Added

- Exported `SseParser` — a standalone, dependency-free Server-Sent Events
  parser with a `push()` / `flush()` incremental API. Handles `\r\n`, `\r` and
  `\n` line endings, comment lines, `event` / `id` / `retry` fields, and
  multi-line `data` payloads, and is covered by a dedicated test suite.

### Changed

- `stream()` is now built on the extracted `SseParser`, making streaming more
  robust and the parsing logic independently testable.
- Failed `chat()` / `complete()` requests now surface as a readable
  `[ngx-ai] Request failed (…)` `Error`, matching the shape thrown by
  `stream()`. The original `HttpErrorResponse` is preserved on `error.cause`.

### Fixed

- `extraBody` could silently override core request fields; `model`, `messages`
  and `stream` (and explicit options) are now always applied last and win.
- Streaming no longer drops events framed with `\r\n`, nor a final event that
  is not terminated by a trailing blank line.

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

[0.5.0]: https://github.com/arul1998/ngx-ai/releases/tag/v0.5.0
[0.4.0]: https://github.com/arul1998/ngx-ai/releases/tag/v0.4.0
[0.3.0]: https://github.com/arul1998/ngx-ai/releases/tag/v0.3.0
[0.2.0]: https://github.com/arul1998/ngx-ai/releases/tag/v0.2.0
[0.1.0]: https://github.com/arul1998/ngx-ai/releases/tag/v0.1.0
