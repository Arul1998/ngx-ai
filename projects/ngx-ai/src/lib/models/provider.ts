/**
 * Internal shapes describing the OpenAI-compatible provider wire format.
 *
 * These are intentionally not part of the public API: they exist so the
 * mapping code is type-checked against the provider payloads instead of
 * reaching into `Record<string, any>`. Every field is optional because a
 * proxy or a minimal provider may omit any of them.
 */

/** A tool call as returned by the provider (`message.tool_calls[]`). */
export interface OpenAiToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

/** A streamed tool-call fragment (`delta.tool_calls[]`). */
export interface OpenAiToolCallDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

/** A message object as returned by the provider (`choices[].message`). */
export interface OpenAiMessage {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
}

/** The incremental message fragment on a streaming choice (`choices[].delta`). */
export interface OpenAiDelta {
  role?: string;
  content?: string | null;
  tool_calls?: OpenAiToolCallDelta[];
}

/** One entry in the provider's `choices` array. */
export interface OpenAiChoice {
  index?: number;
  message?: OpenAiMessage;
  delta?: OpenAiDelta;
  finish_reason?: string | null;
}

/** Token accounting returned by the provider (`usage`). */
export interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** A non-streaming chat completion payload. */
export interface OpenAiCompletionPayload {
  id?: string;
  model?: string;
  choices?: OpenAiChoice[];
  usage?: OpenAiUsage;
}

/** A single streamed chat completion chunk payload. */
export interface OpenAiStreamPayload {
  id?: string;
  model?: string;
  choices?: OpenAiChoice[];
}
