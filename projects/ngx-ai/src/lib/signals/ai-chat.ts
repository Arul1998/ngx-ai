import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgxAiChatService } from '../ngx-ai-chat.service';
import { ChatCompletionOptions, ChatMessage } from '../models/chat.models';

/** Options for {@link injectAiChat}. */
export interface AiChatConfig {
  /** Optional system prompt seeded as the first message of the conversation. */
  system?: string;
  /** Initial conversation history (excluding the system prompt). */
  messages?: ChatMessage[];
}

/**
 * A signal-backed chat store returned by {@link injectAiChat}. Holds the
 * conversation as Angular signals so templates react automatically, while
 * delegating the actual requests to {@link NgxAiChatService}.
 */
export interface AiChat {
  /** The full conversation, including the live-updating assistant reply while streaming. */
  readonly messages: Signal<ChatMessage[]>;
  /** The latest assistant message text (empty if the last message is not from the assistant). */
  readonly response: Signal<string>;
  /** `true` while a non-streaming {@link send} request is in flight. */
  readonly loading: Signal<boolean>;
  /** `true` while a {@link stream} request is producing tokens. */
  readonly streaming: Signal<boolean>;
  /** The most recent error, or `null`. Cleared when a new request starts. */
  readonly error: Signal<Error | null>;

  /** Send a user message and await the complete assistant reply (non-streaming). */
  send(prompt: string, options?: ChatCompletionOptions): void;
  /** Send a user message and stream the assistant reply token-by-token. */
  stream(prompt: string, options?: ChatCompletionOptions): void;
  /** Abort an in-flight streaming request, keeping whatever text arrived so far. */
  abort(): void;
  /** Reset the conversation back to its initial (optionally system-seeded) state. */
  reset(): void;
}

/**
 * Create a reactive, signal-backed chat store bound to the current injection
 * context. Must be called from an injection context (a component/directive
 * field initializer, or within `runInInjectionContext`).
 *
 * @example
 * ```ts
 * export class ChatComponent {
 *   chat = injectAiChat({ system: 'You are concise.' });
 *   ask() { this.chat.stream('Explain Angular signals'); }
 * }
 * ```
 */
export function injectAiChat(config: AiChatConfig = {}): AiChat {
  const service = inject(NgxAiChatService);
  const destroyRef = inject(DestroyRef);

  const seed = (): ChatMessage[] => {
    const initial: ChatMessage[] = [];
    if (config.system) initial.push({ role: 'system', content: config.system });
    if (config.messages) initial.push(...config.messages);
    return initial;
  };

  const messages = signal<ChatMessage[]>(seed());
  const loading = signal(false);
  const streaming = signal(false);
  const error = signal<Error | null>(null);

  const response = computed(() => {
    const list = messages();
    const last = list[list.length - 1];
    return last?.role === 'assistant' ? last.content : '';
  });

  let controller: AbortController | null = null;
  let subscription: Subscription | null = null;

  const cancel = (): void => {
    subscription?.unsubscribe();
    subscription = null;
    controller?.abort();
    controller = null;
  };

  const appendAssistantDelta = (delta: string): void => {
    messages.update((list) => {
      const copy = list.slice();
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, content: last.content + delta };
      return copy;
    });
  };

  const store: AiChat = {
    messages: messages.asReadonly(),
    response,
    loading: loading.asReadonly(),
    streaming: streaming.asReadonly(),
    error: error.asReadonly(),

    send(prompt, options) {
      cancel();
      const history = [...messages(), { role: 'user', content: prompt } as ChatMessage];
      messages.set(history);
      error.set(null);
      loading.set(true);

      subscription = service.chat(history, options).subscribe({
        next: (res) => {
          messages.update((list) => [...list, { role: 'assistant', content: res.content }]);
          loading.set(false);
        },
        error: (err) => {
          loading.set(false);
          error.set(err instanceof Error ? err : new Error(String(err)));
        },
      });
    },

    stream(prompt, options) {
      cancel();
      const history = [...messages(), { role: 'user', content: prompt } as ChatMessage];
      // Append an empty assistant message that fills in as tokens arrive.
      messages.set([...history, { role: 'assistant', content: '' }]);
      error.set(null);
      streaming.set(true);

      controller = new AbortController();
      subscription = service.stream(history, { ...options, signal: controller.signal }).subscribe({
        next: (chunk) => appendAssistantDelta(chunk.delta),
        error: (err) => {
          streaming.set(false);
          error.set(err instanceof Error ? err : new Error(String(err)));
        },
        complete: () => streaming.set(false),
      });
    },

    abort() {
      cancel();
      streaming.set(false);
      loading.set(false);
    },

    reset() {
      cancel();
      messages.set(seed());
      error.set(null);
      streaming.set(false);
      loading.set(false);
    },
  };

  destroyRef.onDestroy(() => cancel());
  return store;
}
