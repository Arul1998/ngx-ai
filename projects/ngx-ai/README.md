# ngx-ai

[![npm version](https://img.shields.io/npm/v/@arulcornelious/ngx-ai.svg)](https://www.npmjs.com/package/@arulcornelious/ngx-ai)
[![npm downloads](https://img.shields.io/npm/dm/@arulcornelious/ngx-ai.svg)](https://www.npmjs.com/package/@arulcornelious/ngx-ai)
[![CI](https://github.com/arul1998/ngx-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/arul1998/ngx-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**RxJS-friendly Angular client for OpenAI-compatible chat APIs** — OpenAI, xAI Grok, or your own backend proxy — with first-class **streaming**.

- 🅰️ **Angular-native** — a `provideNgxAi()` provider, an injectable service, and a signal-backed `injectAiChat()` store. No modules, no boilerplate.
- ⚡ **Signals-first** — `injectAiChat()` exposes `messages()`, `response()`, `loading()`, `streaming()` and `error()` as signals your templates react to automatically.
- 🌊 **Streaming built in** — subscribe to tokens as they arrive; unsubscribe to abort.
- 🛠️ **Tool calling & structured output** — typed `tools` / `tool_calls` and a `json<T>()` helper for JSON responses.
- 🔌 **Provider presets** — `openai` and `grok` out of the box, plus `custom` for your proxy.
- 🧩 **Typed, RxJS-first API** — everything returns `Observable`s that compose with the rest of your app.
- 🔐 **Safe by default** — refuses to ship an API key to the browser unless you explicitly opt in.

> **Compatibility:** built and CI-tested on Angular 22 (Node 20 & 22). The
> library uses only APIs available since Angular 16 — signals, `inject`,
> standalone providers — so the `>=17` peer range is intentionally conservative.
> Hit a snag on an older version? [Open an issue](https://github.com/arul1998/ngx-ai/issues).

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

## Structured output

`json<T>()` asks the model for a JSON object and parses the reply into `T`. It
sets `response_format` to `{ type: 'json_object' }` by default, and raises a
readable error if the model returns something that isn't valid JSON.

```ts
interface Weather {
  city: string;
  celsius: number;
}

this.ai
  .json<Weather>([{ role: 'user', content: 'Weather in Paris as JSON: city, celsius' }])
  .subscribe((w) => console.log(w.city, w.celsius));
```

Need a strict schema? Pass your own `responseFormat` (e.g. a provider
`json_schema` spec) and it overrides the default:

```ts
this.ai.json<Weather>(messages, {
  responseFormat: {
    type: 'json_schema',
    json_schema: {
      name: 'weather',
      schema: {
        type: 'object',
        properties: { city: { type: 'string' }, celsius: { type: 'number' } },
        required: ['city', 'celsius'],
      },
    },
  },
});
```

## Tool calling

Expose functions to the model with `tools`, then run whichever calls it asks
for and feed the results back as `tool` messages. `arguments` arrives as a JSON
**string** — parse it before use.

```ts
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a city',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      },
    },
  },
];

const messages: ChatMessage[] = [{ role: 'user', content: "What's the weather in Paris?" }];

this.ai.chat(messages, { tools }).subscribe((res) => {
  for (const call of res.toolCalls ?? []) {
    const args = JSON.parse(call.function.arguments);
    const result = getWeather(args.city); // your function

    // Add the assistant's request and your tool result, then ask again.
    messages.push({ role: 'assistant', content: res.content, tool_calls: res.toolCalls });
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
  }
  this.ai.chat(messages).subscribe((final) => console.log(final.content));
});
```

While streaming, tool-call fragments arrive on `chunk.toolCalls` (keyed by
`index`); concatenate each index's `function.arguments` fragments to rebuild the
full call.

## Errors & retries

Every failed request — streaming or not — rejects with an **`NgxAiError`**
carrying a readable message and the HTTP `status`, so you can branch on it:

```ts
import { NgxAiError } from '@arulcornelious/ngx-ai';

this.ai.chat(messages).subscribe({
  error: (err) => {
    if (err instanceof NgxAiError && err.status === 429) {
      // back off and try again later
    }
  },
});
```

Opt into automatic retries for transient failures (network errors and HTTP
`5xx`) on the non-streaming calls with exponential backoff — `4xx` responses are
never retried:

```ts
this.ai.chat(messages, { retry: 2 }).subscribe(/* … */);
```

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

| Method                        | Returns                              | Description                                 |
| ----------------------------- | ------------------------------------ | ------------------------------------------- |
| `chat(messages, options?)`    | `Observable<ChatCompletionResponse>` | One complete response.                      |
| `complete(prompt, options?)`  | `Observable<string>`                 | Convenience wrapper emitting just the text. |
| `json<T>(messages, options?)` | `Observable<T>`                      | Structured output, parsed into `T`.         |
| `stream(messages, options?)`  | `Observable<ChatStreamChunk>`        | Token-by-token streaming.                   |

`ChatCompletionOptions`: `model`, `temperature`, `maxTokens`, `topP`, `stop`,
`responseFormat`, `tools`, `toolChoice`, `retry`, `signal`, `extraBody`.

## Demo

The repo ships a runnable Angular app that exercises streaming chat via
`injectAiChat()`, cancellation, and live error handling. Clone the repo, then:

```bash
npm install
npm run build   # build the library the demo consumes
npm start       # http://localhost:4200
```

## Stability

As of **v1.0.0** the public API is stable and follows
[Semantic Versioning](https://semver.org/): breaking changes to the exported
surface (`provideNgxAi`, `NgxAiChatService`, `injectAiChat`, `NgxAiError`, and
the exported types) will only land in a new major version.

> **Migrating from 0.x:** the only breaking type change during the 0.x line was
> `ChatMessage.content`, which became `string | null` in 0.5.0 to support
> assistant messages that contain only tool calls. If you read `content` as a
> plain `string`, coalesce it: `msg.content ?? ''`.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](https://github.com/arul1998/ngx-ai/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) © Arul Cornelious
