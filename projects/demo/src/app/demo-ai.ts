import { EnvironmentProviders, Injectable, makeEnvironmentProviders, signal } from '@angular/core';
import { AiProvider, NGX_AI_CONFIG, ResolvedNgxAiConfig } from '@arulcornelious/ngx-ai';

const PRESETS: Record<AiProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  grok: { baseUrl: 'https://api.x.ai/v1', model: 'grok-2-latest' },
  custom: { baseUrl: '', model: '' },
};

/**
 * Runtime-editable ngx-ai settings for the demo. Because {@link NgxAiChatService}
 * reads `baseUrl` / `model` / `apiKey` off the config object at request time, the
 * live config below delegates to these signals — so changing a field in the UI
 * takes effect on the next request without re-bootstrapping.
 */
@Injectable({ providedIn: 'root' })
export class DemoSettings {
  readonly provider = signal<AiProvider>('custom');
  readonly baseUrl = signal('/api/ai');
  readonly model = signal('');
  readonly apiKey = signal('');

  resolvedBaseUrl(): string {
    const base = this.baseUrl().trim() || PRESETS[this.provider()].baseUrl;
    return base.replace(/\/+$/, '');
  }

  resolvedModel(): string {
    return this.model().trim() || PRESETS[this.provider()].model;
  }
}

/** Provide ngx-ai wired to the live {@link DemoSettings}. */
export function provideDemoAi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: NGX_AI_CONFIG,
      useFactory: liveConfig,
      deps: [DemoSettings],
    },
  ]);
}

function liveConfig(settings: DemoSettings): ResolvedNgxAiConfig {
  return {
    get provider() {
      return settings.provider();
    },
    get baseUrl() {
      return settings.resolvedBaseUrl();
    },
    get model() {
      return settings.resolvedModel();
    },
    get apiKey() {
      return settings.apiKey().trim() || undefined;
    },
    // The demo intentionally allows a browser key so it runs without a backend.
    dangerouslyAllowBrowserApiKey: true,
  } as ResolvedNgxAiConfig;
}
