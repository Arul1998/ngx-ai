import { ChatStreamChunk } from '../models/chat.models';
import { OpenAiStreamPayload } from '../models/provider';

/** Sentinel returned when the stream's terminating `[DONE]` payload is seen. */
export const STREAM_DONE = Symbol('ngx-ai/stream-done');

/**
 * Map the `data` payload of one SSE event to a {@link ChatStreamChunk}.
 *
 * Returns {@link STREAM_DONE} for the `[DONE]` sentinel that OpenAI-compatible
 * APIs send to close a stream, and `null` for payloads that carry no usable
 * delta (empty data, keep-alive comments already stripped upstream, or JSON
 * that fails to parse).
 */
export function chatChunkFromSseData(
  data: string,
  fallbackModel: string,
): ChatStreamChunk | typeof STREAM_DONE | null {
  const payload = data.trim();
  if (payload === '') return null;
  if (payload === '[DONE]') return STREAM_DONE;

  let json: OpenAiStreamPayload;
  try {
    json = JSON.parse(payload);
  } catch {
    return null;
  }

  const choice = json.choices?.[0];
  const toolCallDeltas = choice?.delta?.tool_calls;
  return {
    id: json.id ?? '',
    model: json.model ?? fallbackModel,
    delta: choice?.delta?.content ?? '',
    ...(toolCallDeltas?.length
      ? {
          toolCalls: toolCallDeltas.map((call) => ({
            index: call.index ?? 0,
            id: call.id,
            type: call.type === 'function' ? ('function' as const) : undefined,
            function: call.function,
          })),
        }
      : {}),
    finishReason: choice?.finish_reason ?? null,
    raw: json,
  };
}
