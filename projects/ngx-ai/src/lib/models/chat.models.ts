/**
 * Role of a message in a chat conversation.
 */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A single message in a chat conversation.
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Optional name of the participant (used by some providers/tools). */
  name?: string;
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
  /** The full assistant message content. */
  content: string;
  /** Why generation stopped (e.g. `stop`, `length`), when reported. */
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
  /** Why generation stopped, present only on the final chunk. */
  finishReason: string | null;
  /** The untouched provider chunk payload, for advanced use. */
  raw: unknown;
}
