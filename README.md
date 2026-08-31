# ngx-ai

> RxJS-friendly Angular client for OpenAI-compatible chat APIs (OpenAI, xAI Grok, or your own proxy) with first-class streaming.

[![CI](https://github.com/arul1998/ngx-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/arul1998/ngx-ai/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@arulcornelious/ngx-ai.svg)](https://www.npmjs.com/package/@arulcornelious/ngx-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

This is the monorepo for the **`ngx-ai`** Angular library.
📦 **[Full library documentation and usage →](projects/ngx-ai/README.md)**

```
✓ Streaming        ✓ Angular Signals   ✓ RxJS-first
✓ Structured JSON  ✓ Tool calling      ✓ Type-safe
✓ OpenAI · Grok · custom proxies       ✓ Safe-by-default keys
```

## Why

Wiring an LLM into an Angular app usually means hand-rolling `fetch`, parsing
server-sent events by hand, and leaking API keys into the browser. `ngx-ai`
turns that into a one-line provider and an injectable, RxJS-first service — with
streaming and a safe-by-default key policy built in.

## Repository layout

| Path | Description |
| --- | --- |
| [`projects/ngx-ai`](projects/ngx-ai) | The publishable library source. |
| [`projects/demo`](projects/demo) | A runnable Angular app showcasing the library. |
| [`dist/ngx-ai`](dist) | Build output (generated). |

## Demo

A small Angular app in [`projects/demo`](projects/demo) exercises the library —
streaming chat via `injectAiChat()`, cancellation, live error handling, and a
runtime provider/model/key switcher. Run it locally:

```bash
npm run build    # build the library the demo consumes
npm start        # serve the demo at http://localhost:4200
```

Point **Base URL** at your own OpenAI-compatible proxy, or pick a provider and
paste a key (the demo opts into a browser key for convenience; the library is
safe-by-default and refuses this unless you explicitly opt in).

## Development

```bash
npm install      # install dependencies
npm run build    # build the library to dist/ngx-ai
npm run build:demo   # build the demo app to dist/demo
npm test         # run the unit tests
npm run format:check  # check formatting
```

## Publishing

```bash
npm run build
cd dist/ngx-ai
npm publish --access public
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

[MIT](LICENSE) © [Arul Cornelious](https://arulcornelious.com)
