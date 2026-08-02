import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { NGX_AI_CONFIG, ResolvedNgxAiConfig } from './ngx-ai.config';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
  ChatStreamChunk,
} from './models/chat.models';

/**
 * RxJS-friendly client for OpenAI-compatible chat completion APIs
 * (OpenAI, xAI Grok, or your own proxy).
 *
 * Provide it once via {@link provideNgxAi}, then inject it anywhere.
 */
@Injectable({ providedIn: 'root' })
export class NgxAiChatService {
  private readonly http = inject(HttpClient);
  private readonly config = inject<ResolvedNgxAiConfig>(NGX_AI_CONFIG);

  /**
   * Request a single, complete chat response.
   *
   * @example
   * ```ts
   * ai.chat([{ role: 'user', content: 'Hello!' }]).subscribe(r => console.log(r.content));
   * ```
   */
  chat(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Observable<ChatCompletionResponse> {
    const body = this.buildBody(messages, options, false);
    return this.http
      .post<Record<string, any>>(`${this.config.baseUrl}/chat/completions`, body, {
        headers: this.buildHeaders(),
      })
      .pipe(map((res) => this.mapCompletion(res)));
  }

  /**
   * Convenience wrapper around {@link chat} that emits only the text content.
   */
  complete(prompt: string, options: ChatCompletionOptions = {}): Observable<string> {
    return this.chat([{ role: 'user', content: prompt }], options).pipe(map((r) => r.content));
  }

  /**
   * Stream a chat response token-by-token. The returned Observable emits one
   * {@link ChatStreamChunk} per server-sent event and completes when the
   * stream ends. Unsubscribing (or passing `options.signal`) aborts the
   * underlying request.
   *
   * Streaming uses `fetch` directly, so it bypasses Angular `HttpClient`
   * interceptors. Apply auth on your proxy or via `config.headers`.
   *
   * @example
   * ```ts
   * ai.stream([{ role: 'user', content: 'Write a haiku' }])
   *   .subscribe(chunk => this.text += chunk.delta);
   * ```
   */
  stream(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {},
  ): Observable<ChatStreamChunk> {
    const body = this.buildBody(messages, options, true);

    return new Observable<ChatStreamChunk>((subscriber) => {
      const controller = new AbortController();
      const externalSignal = options.signal;
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      (async () => {
        try {
          const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { ...this.buildHeaders(), Accept: 'text/event-stream' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            const detail = await safeReadText(response);
            throw new Error(
              `[ngx-ai] Stream request failed (${response.status} ${response.statusText}). ${detail}`,
            );
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary: number;
            // SSE events are separated by a blank line.
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const chunk = parseSseEvent(rawEvent, this.config.model);
              if (chunk === 'DONE') {
                subscriber.complete();
                return;
              }
              if (chunk) subscriber.next(chunk);
            }
          }

          subscriber.complete();
        } catch (err) {
          if (controller.signal.aborted) {
            subscriber.complete();
          } else {
            subscriber.error(err);
          }
        }
      })();

      // Teardown: abort the fetch when unsubscribed.
      return () => controller.abort();
    });
  }

  private buildBody(
    messages: ChatMessage[],
    options: ChatCompletionOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.config.model,
      messages,
      stream,
      ...options.extraBody,
    };
    if (options.temperature !== undefined) body['temperature'] = options.temperature;
    if (options.maxTokens !== undefined) body['max_tokens'] = options.maxTokens;
    if (options.topP !== undefined) body['top_p'] = options.topP;
    if (options.stop !== undefined) body['stop'] = options.stop;
    return body;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  private mapCompletion(res: Record<string, any>): ChatCompletionResponse {
    const choice = res?.['choices']?.[0] ?? {};
    const usage = res?.['usage'];
    return {
      id: res?.['id'] ?? '',
      model: res?.['model'] ?? this.config.model,
      content: choice?.['message']?.['content'] ?? '',
      finishReason: choice?.['finish_reason'] ?? null,
      usage: usage
        ? {
            promptTokens: usage['prompt_tokens'] ?? 0,
            completionTokens: usage['completion_tokens'] ?? 0,
            totalTokens: usage['total_tokens'] ?? 0,
          }
        : undefined,
      raw: res,
    };
  }
}

/** Parse one SSE event block into a stream chunk, or `'DONE'` at end of stream. */
function parseSseEvent(rawEvent: string, fallbackModel: string): ChatStreamChunk | 'DONE' | null {
  // An event may contain multiple `data:` lines; concatenate their payloads.
  const dataLines = rawEvent
    .split('\n')
    .map((line) => line.trimStart())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim());

  if (dataLines.length === 0) return null;

  const payload = dataLines.join('');
  if (payload === '[DONE]') return 'DONE';

  let json: Record<string, any>;
  try {
    json = JSON.parse(payload);
  } catch {
    return null;
  }

  const choice = json?.['choices']?.[0] ?? {};
  return {
    id: json?.['id'] ?? '',
    model: json?.['model'] ?? fallbackModel,
    delta: choice?.['delta']?.['content'] ?? '',
    finishReason: choice?.['finish_reason'] ?? null,
    raw: json,
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
