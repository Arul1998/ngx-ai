import { resolveNgxAiConfig } from './ngx-ai.config';

describe('resolveNgxAiConfig', () => {
  it('applies OpenAI defaults', () => {
    const cfg = resolveNgxAiConfig({ provider: 'openai' });
    expect(cfg.baseUrl).toBe('https://api.openai.com/v1');
    expect(cfg.model).toBe('gpt-4o-mini');
  });

  it('defaults the provider to openai', () => {
    const cfg = resolveNgxAiConfig({});
    expect(cfg.provider).toBe('openai');
  });

  it('applies Grok defaults', () => {
    const cfg = resolveNgxAiConfig({ provider: 'grok' });
    expect(cfg.baseUrl).toBe('https://api.x.ai/v1');
    expect(cfg.model).toBe('grok-2-latest');
  });

  it('strips trailing slashes from baseUrl', () => {
    const cfg = resolveNgxAiConfig({ provider: 'custom', baseUrl: '/api/ai/' });
    expect(cfg.baseUrl).toBe('/api/ai');
  });

  it('lets explicit values override preset defaults', () => {
    const cfg = resolveNgxAiConfig({ provider: 'openai', model: 'gpt-4o' });
    expect(cfg.model).toBe('gpt-4o');
  });

  it('throws when a custom provider has no baseUrl', () => {
    expect(() => resolveNgxAiConfig({ provider: 'custom' })).toThrowError(/baseUrl/);
  });

  it('throws when an apiKey is set without opting in to browser exposure', () => {
    expect(() => resolveNgxAiConfig({ apiKey: 'sk-test' })).toThrowError(
      /dangerouslyAllowBrowserApiKey/,
    );
  });

  it('allows a browser apiKey when explicitly opted in', () => {
    const cfg = resolveNgxAiConfig({ apiKey: 'sk-test', dangerouslyAllowBrowserApiKey: true });
    expect(cfg.apiKey).toBe('sk-test');
  });
});
