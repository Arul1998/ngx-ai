import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
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
      .pipe(
        map((res) => this.mapCompletion(res)),
        catchError((err) => throwError(() => toNgxAiError(err))),
      );
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

          // Emit every complete event currently buffered. Returns true when a
          // `[DONE]` sentinel was seen and the stream should be finished.
          const drain = (): boolean => {
            let boundary: number;
            // SSE events are separated by a blank line.
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
              const rawEvent = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const chunk = parseSseEvent(rawEvent, this.config.model);
              if (chunk === 'DONE') return true;
              if (chunk) subscriber.next(chunk);
            }
            return false;
          };

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            // Normalize CRLF so boundary/line splitting works regardless of how
            // the server (or an intervening proxy) frames its events.
            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
            if (drain()) {
              subscriber.complete();
              return;
            }
          }

          // Flush any bytes the decoder was still holding, then process a final
          // event that was not terminated by a trailing blank line.
          buffer += decoder.decode().replace(/\r\n/g, '\n');
          if (!drain()) {
            const rawEvent = buffer.trim();
            if (rawEvent) {
              const chunk = parseSseEvent(rawEvent, this.config.model);
              if (chunk && chunk !== 'DONE') subscriber.next(chunk);
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
      // Spread caller-supplied fields first so the core fields below always win
      // and cannot be silently clobbered (e.g. `extraBody: { stream: false }`).
      ...options.extraBody,
      model: options.model ?? this.config.model,
      messages,
      stream,
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

/**
 * Normalize a failed `HttpClient` request into a single, readable `[ngx-ai]`
 * error, matching the shape thrown by {@link NgxAiChatService.stream}. The
 * original `HttpErrorResponse` is preserved on the `cause` for advanced use.
 */
function toNgxAiError(err: unknown): Error {
  if (err instanceof HttpErrorResponse) {
    const detail = extractErrorDetail(err.error);
    const message =
      `[ngx-ai] Request failed (${err.status} ${err.statusText}).` + (detail ? ` ${detail}` : '');
    return new Error(message, { cause: err });
  }
  return err instanceof Error ? err : new Error(`[ngx-ai] Request failed. ${String(err)}`);
}

/** Pull a human-readable message out of a provider error payload, if present. */
function extractErrorDetail(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    const error = (body as Record<string, any>)['error'];
    const message = typeof error === 'object' ? error?.['message'] : error;
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(body);
    } catch {
      return '';
    }
  }
  return '';
}
