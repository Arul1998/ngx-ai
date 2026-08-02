import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { NGX_AI_CONFIG, ResolvedNgxAiConfig } from './ngx-ai.config';
import {
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatMessage,
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
