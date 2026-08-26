# ngx-ai

[![npm version](https://img.shields.io/npm/v/@arulcornelious/ngx-ai.svg)](https://www.npmjs.com/package/@arulcornelious/ngx-ai)
[![npm downloads](https://img.shields.io/npm/dm/@arulcornelious/ngx-ai.svg)](https://www.npmjs.com/package/@arulcornelious/ngx-ai)
[![CI](https://github.com/arul1998/ngx-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/arul1998/ngx-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**RxJS-friendly Angular client for OpenAI-compatible chat APIs** — OpenAI, xAI Grok, or your own backend proxy — with first-class **streaming**.

- 🅰️ **Angular-native** — a `provideNgxAi()` provider, an injectable service, and a signal-backed `injectAiChat()` store. No modules, no boilerplate.
- ⚡ **Signals-first** — `injectAiChat()` exposes `messages()`, `response()`, `loading()`, `streaming()` and `error()` as signals your templates react to automatically.
- 🌊 **Streaming built in** — subscribe to tokens as they arrive; unsubscribe to abort.
- 🔌 **Provider presets** — `openai` and `grok` out of the box, plus `custom` for your proxy.
- 🧩 **Typed, RxJS-first API** — everything returns `Observable`s that compose with the rest of your app.
- 🔐 **Safe by default** — refuses to ship an API key to the browser unless you explicitly opt in.

> Built with Angular 22 and CI-tested there. Uses only stable Angular APIs (`inject`, standalone providers). If you need a specific older Angular version supported, please [open an issue](https://github.com/arul1998/ngx-ai/issues).

## Installation

```bash
npm install @arulcornelious/ngx-ai
```

## Quick start

Register the provider once (standalone bootstrap shown):

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideNgxAi } from '@arulcornelious/ngx-ai';
import { App } from './app/app';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    // Recommended: route through your own backend so the API key stays server-side.
    provideNgxAi({ provider: 'custom', baseUrl: '/api/ai' }),
  ],
});
```

Inject the service and chat:

```ts
import { Component, inject, signal } from '@angular/core';
import { NgxAiChatService } from '@arulcornelious/ngx-ai';

@Component({
  selector: 'app-chat',
  template: `
    <button (click)="ask()">Ask</button>
    <p>{{ answer() }}</p>
  `,
})
export class ChatComponent {
  private readonly ai = inject(NgxAiChatService);
  readonly answer = signal('');

  ask() {
    this.ai
      .chat([{ role: 'user', content: 'Explain RxJS in one sentence.' }])
      .subscribe((res) => this.answer.set(res.content));
  }
}
```

## Streaming

`stream()` emits one chunk per server-sent event and completes when the model is done. Unsubscribing aborts the request.

```ts
ask() {
  this.answer.set('');
  this.ai
    .stream([{ role: 'user', content: 'Write a haiku about Angular.' }])
    .subscribe({
      next: (chunk) => this.answer.update((t) => t + chunk.delta),
      complete: () => console.log('done'),
    });
}
```

## Signals API

Prefer signals over subscriptions? `injectAiChat()` gives you a reactive chat
store that manages the conversation for you. Call it from a component (an
injection context) and bind straight to the signals — no manual subscribe, and
in-flight requests are aborted automatically when the component is destroyed.

```ts
import { Component } from '@angular/core';
import { injectAiChat } from '@arulcornelious/ngx-ai';

@Component({
  selector: 'app-chat',
  template: `
    @for (m of chat.messages(); track $index) {
      <p>
        <b>{{ m.role }}:</b> {{ m.content }}
      </p>
    }
    @if (chat.streaming()) {
      <p>…</p>
    }
    @if (chat.error(); as e) {
      <p class="error">{{ e.message }}</p>
    }
    <button (click)="chat.stream('Explain Angular signals in one line')">Ask</button>
  `,
})
export class ChatComponent {
  readonly chat = injectAiChat({ system: 'You are concise.' });
}
```

| Member           | Type                    | Description                                            |
| ---------------- | ----------------------- | ------------------------------------------------------ |
| `messages()`     | `Signal<ChatMessage[]>` | The conversation; the assistant reply updates live.    |
| `response()`     | `Signal<string>`        | The latest assistant message text.                     |
| `loading()`      | `Signal<boolean>`       | `true` during a non-streaming `send()`.                |
| `streaming()`    | `Signal<boolean>`       | `true` while `stream()` is producing tokens.           |
| `error()`        | `Signal<Error \| null>` | The most recent error, cleared when a request starts.  |
| `send(prompt)`   | `void`                  | Send a message and await the full reply.               |
| `stream(prompt)` | `void`                  | Send a message and stream the reply token-by-token.    |
| `abort()`        | `void`                  | Cancel an in-flight stream, keeping text so far.       |
| `reset()`        | `void`                  | Reset to the initial (optionally system-seeded) state. |

`send()` and `stream()` accept the same `ChatCompletionOptions` as the service.

## Configuration

| Option                          | Type                             | Default    | Notes                                                   |
| ------------------------------- | -------------------------------- | ---------- | ------------------------------------------------------- |
| `provider`                      | `'openai' \| 'grok' \| 'custom'` | `'openai'` | Selects preset `baseUrl` and `model`.                   |
| `baseUrl`                       | `string`                         | preset     | API base. Point at your proxy for browser apps.         |
| `model`                         | `string`                         | preset     | Default model when a request omits one.                 |
| `apiKey`                        | `string`                         | –          | Bearer token. Requires `dangerouslyAllowBrowserApiKey`. |
| `headers`                       | `Record<string,string>`          | –          | Extra headers merged into every request.                |
| `dangerouslyAllowBrowserApiKey` | `boolean`                        | `false`    | Opt in to shipping a key to the browser.                |

### Provider presets

```ts
provideNgxAi({ provider: 'openai' }); // https://api.openai.com/v1, gpt-4o-mini
provideNgxAi({ provider: 'grok' }); // https://api.x.ai/v1, grok-2-latest
provideNgxAi({ provider: 'custom', baseUrl: '/api/ai' }); // your proxy
```

## 🔐 A note on API keys

Any key bundled into an Angular app is visible to every visitor. **ngx-ai throws if you set `apiKey` without `dangerouslyAllowBrowserApiKey: true`.** For production, run a thin backend that holds the key and forwards to the provider, then point `baseUrl` at it:

```ts
provideNgxAi({ provider: 'custom', baseUrl: '/api/ai' });
```

The `custom` provider speaks the standard OpenAI chat-completions shape, so most proxies are a few lines of code.

## API

### `NgxAiChatService`

| Method                       | Returns                              | Description                                 |
| ---------------------------- | ------------------------------------ | ------------------------------------------- |
| `chat(messages, options?)`   | `Observable<ChatCompletionResponse>` | One complete response.                      |
| `complete(prompt, options?)` | `Observable<string>`                 | Convenience wrapper emitting just the text. |
| `stream(messages, options?)` | `Observable<ChatStreamChunk>`        | Token-by-token streaming.                   |

`ChatCompletionOptions`: `model`, `temperature`, `maxTokens`, `topP`, `stop`, `signal`, `extraBody`.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](https://github.com/arul1998/ngx-ai/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) © Arul Cornelious
