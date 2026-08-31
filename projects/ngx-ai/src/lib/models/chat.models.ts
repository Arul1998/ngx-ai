/**
 * Role of a message in a chat conversation.
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A tool call requested by the assistant. `arguments` is a JSON **string**
 * (parse it before use) so it can be streamed and forwarded verbatim.
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * A single message in a chat conversation.
 */
export interface ChatMessage {
  role: ChatRole;
  /**
   * The message text. May be `null` on an assistant message that only
   * requests tool calls.
   */
  content: string | null;
  /** Optional name of the participant (used by some providers/tools). */
  name?: string;
  /** Tool calls requested by the assistant (role `assistant`). */
  tool_calls?: ToolCall[];
  /** The id of the tool call this message answers (role `tool`). */
  tool_call_id?: string;
}

/**
 * A callable tool exposed to the model. Currently only `function` tools are
 * defined by the OpenAI-compatible spec.
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    /** JSON Schema describing the function parameters. */
    parameters?: Record<string, unknown>;
  };
}

/**
 * How the model should choose tools: a preset, or a specific function to force.
 */
export type ToolChoice =
  'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };

/**
 * A streamed fragment of a tool call. The provider sends these incrementally,
 * keyed by `index`; concatenate `function.arguments` fragments per index to
 * rebuild the full call.
 */
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * Per-request options for a chat completion. All fields are optional and,
 * where omitted, fall back to the values configured via `provideNgxAi`.
 */
export interface ChatCompletionOptions {
  /** Model id (e.g. `gpt-4o-mini`, `grok-2-latest`). Overrides the configured default. */
  model?: string;
  /** Sampling temperature, typically 0 to 2. */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  maxTokens?: number;
  /** Nucleus sampling probability mass. */
  topP?: number;
  /** Stop sequence(s) that halt generation. */
  stop?: string | string[];
  /**
   * Provider `response_format`, e.g. `{ type: 'json_object' }` or a
   * `{ type: 'json_schema', json_schema: … }` spec for structured output.
   * {@link NgxAiChatService.json} sets `{ type: 'json_object' }` by default.
   */
  responseFormat?: unknown;
  /** Tools (functions) the model may call. */
  tools?: ToolDefinition[];
  /** Constrains which tool, if any, the model may call. */
  toolChoice?: ToolChoice;
  /**
   * Number of extra attempts on a **transient** failure (network error or HTTP
   * 5xx) for non-streaming `chat()` / `json()`, with exponential backoff.
   * Defaults to `0` (no retry). 4xx errors are never retried.
   */
  retry?: number;
  /** Abort signal to cancel an in-flight streaming request. */
  signal?: AbortSignal;
  /** Provider-specific fields merged as-is into the request body. */
  extraBody?: Record<string, unknown>;
}

/**
 * Token accounting returned by the provider when available.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Result of a non-streaming chat completion.
 */
export interface ChatCompletionResponse {
  id: string;
  model: string;
  /** The full assistant message content (empty string when only tools are called). */
  content: string;
  /** Tool calls the assistant requested, when any. */
  toolCalls?: ToolCall[];
  /** Why generation stopped (e.g. `stop`, `length`, `tool_calls`), when reported. */
  finishReason: string | null;
  usage?: TokenUsage;
  /** The untouched provider payload, for advanced use. */
  raw: unknown;
}

/**
 * A single incremental chunk emitted while streaming a chat completion.
 */
export interface ChatStreamChunk {
  id: string;
  model: string;
  /** The incremental text produced by this chunk (may be empty). */
  delta: string;
  /** Incremental tool-call fragments in this chunk, when the model is calling tools. */
  toolCalls?: ToolCallDelta[];
  /** Why generation stopped, present only on the final chunk. */
  finishReason: string | null;
  /** The untouched provider chunk payload, for advanced use. */
  raw: unknown;
}
