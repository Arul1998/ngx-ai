# Contributing to ngx-ai

Thanks for your interest in improving ngx-ai! Contributions of all sizes are
welcome — bug reports, docs, and pull requests.

## Getting started

```bash
git clone https://github.com/arul1998/ngx-ai.git
cd ngx-ai
npm install
```

## Common tasks

| Task | Command |
| --- | --- |
| Build the library | `npm run build` |
| Run unit tests | `npm test` |
| Format check | `npm run format:check` |

The library source lives in [`projects/ngx-ai/src`](projects/ngx-ai/src).

## Pull requests

1. Fork the repo and create a feature branch (`git checkout -b feat/my-change`).
2. Add or update tests for your change — CI runs `npm test` on every PR.
3. Keep the public API documented with TSDoc comments.
4. Use clear, [Conventional Commit](https://www.conventionalcommits.org/) style
   messages (e.g. `feat: add tool-calling support`).
5. Open a PR describing the motivation and the change.

## Reporting bugs

Please include your Angular version, a minimal reproduction, and the expected vs.
actual behaviour when you [open an issue](https://github.com/arul1998/ngx-ai/issues).

## Code of conduct

Be respectful and constructive. We follow the spirit of the
[Contributor Covenant](https://www.contributor-covenant.org/).
