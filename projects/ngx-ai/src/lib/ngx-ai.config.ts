import { InjectionToken } from '@angular/core';

/**
 * Supported provider presets. `custom` is intended for your own
 * backend proxy that speaks the OpenAI-compatible chat completions API.
 */
export type AiProvider = 'openai' | 'grok' | 'custom';

/**
 * Configuration for ngx-ai, supplied through {@link provideNgxAi}.
 */
export interface NgxAiConfig {
  /**
   * Provider preset. Selects sensible defaults for `baseUrl` and `model`.
   * Defaults to `openai`.
   */
  provider?: AiProvider;

  /**
   * API key sent as a Bearer token. Prefer routing requests through your own
   * backend (a `custom` provider `baseUrl`) so the key never reaches the
   * browser. If you must set a key client-side you also have to opt in via
   * {@link dangerouslyAllowBrowserApiKey}.
   */
  apiKey?: string;

  /**
   * Base URL of the API. Overrides the provider preset. Point this at your
   * own proxy for production browser apps.
   */
  baseUrl?: string;

  /**
   * Default model id used when a request does not specify one.
   */
  model?: string;

  /**
   * Extra headers merged into every request (e.g. for a proxy).
   */
  headers?: Record<string, string>;

  /**
   * Must be `true` to allow shipping an `apiKey` to the browser. Off by
   * default because a bundled key is visible to every visitor.
   */
  dangerouslyAllowBrowserApiKey?: boolean;
}

/** Fully-resolved configuration used internally by the service. */
export interface ResolvedNgxAiConfig extends NgxAiConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
}

interface ProviderDefaults {
  baseUrl: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<AiProvider, ProviderDefaults> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest' },
  custom: { baseUrl: '', model: '' },
};

/** DI token holding the resolved ngx-ai configuration. */
export const NGX_AI_CONFIG = new InjectionToken<ResolvedNgxAiConfig>('NGX_AI_CONFIG');

/**
 * Resolve a partial {@link NgxAiConfig} against its provider preset,
 * validating that required values are present.
 */
export function resolveNgxAiConfig(config: NgxAiConfig): ResolvedNgxAiConfig {
  const provider = config.provider ?? 'openai';
  const defaults = PROVIDER_DEFAULTS[provider];
  const baseUrl = (config.baseUrl ?? defaults.baseUrl).replace(/\/+$/, '');
  const model = config.model ?? defaults.model;

  if (!baseUrl) {
    throw new Error(
      `[ngx-ai] A "baseUrl" is required when provider is "custom". ` +
        `Point it at your backend proxy, e.g. provideNgxAi({ provider: 'custom', baseUrl: '/api/ai' }).`,
    );
  }

  if (config.apiKey && !config.dangerouslyAllowBrowserApiKey) {
    throw new Error(
      `[ngx-ai] An "apiKey" was provided but "dangerouslyAllowBrowserApiKey" is not set. ` +
        `Shipping an API key to the browser exposes it to every visitor. ` +
        `Prefer a backend proxy (provider: 'custom', baseUrl: '/api/ai'). ` +
        `If this is a trusted internal tool, opt in with dangerouslyAllowBrowserApiKey: true.`,
    );
  }

  return { ...config, provider, baseUrl, model };
}
