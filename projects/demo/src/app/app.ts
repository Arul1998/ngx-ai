import { Component, inject, signal } from '@angular/core';
import { injectAiChat } from '@arulcornelious/ngx-ai';
import { DemoSettings } from './demo-ai';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <header>
      <h1>ngx-ai</h1>
      <p>RxJS &amp; signals-first Angular client for OpenAI-compatible chat APIs.</p>
    </header>

    <main>
      <section class="card">
        <h2>Connection</h2>
        <p class="hint">
          The library is safe-by-default. This demo opts into a browser key for convenience — in
          production, point <code>baseUrl</code> at your own proxy instead.
        </p>
        <div class="grid">
          <label>
            Provider
            <select [value]="settings.provider()" (change)="setProvider($event)">
              <option value="custom">custom (proxy)</option>
              <option value="openai">openai</option>
              <option value="grok">grok</option>
            </select>
          </label>
          <label>
            Base URL
            <input
              [value]="settings.baseUrl()"
              (input)="settings.baseUrl.set(value($event))"
              placeholder="/api/ai"
            />
          </label>
          <label>
            Model
            <input
              [value]="settings.model()"
              (input)="settings.model.set(value($event))"
              placeholder="(provider default)"
            />
          </label>
          <label>
            API key <span class="muted">(optional; stays in your browser)</span>
            <input
              type="password"
              [value]="settings.apiKey()"
              (input)="settings.apiKey.set(value($event))"
              placeholder="sk-…"
            />
          </label>
        </div>
      </section>

      <section class="card">
        <h2>Chat</h2>
        <div class="messages">
          @for (m of chat.messages(); track $index) {
            <div class="msg" [class.user]="m.role === 'user'">
              <span class="role">{{ m.role }}</span>
              <span class="body">{{ m.content }}</span>
            </div>
          } @empty {
            <p class="muted">Ask something to get started.</p>
          }
          @if (chat.streaming()) {
            <div class="msg"><span class="role">…</span><span class="body">streaming</span></div>
          }
        </div>

        @if (chat.error(); as e) {
          <p class="error">{{ e.message }}</p>
        }

        <form class="composer" (submit)="ask($event)">
          <input
            [value]="prompt()"
            (input)="prompt.set(value($event))"
            placeholder="Write a haiku about Angular…"
            [disabled]="chat.streaming()"
          />
          @if (chat.streaming()) {
            <button type="button" class="stop" (click)="chat.abort()">Stop</button>
          } @else {
            <button type="submit" [disabled]="!prompt().trim()">Ask</button>
          }
        </form>
        <button class="link" type="button" (click)="chat.reset()">Reset conversation</button>
      </section>
    </main>

    <footer>
      <a href="https://www.npmjs.com/package/@arulcornelious/ngx-ai" target="_blank" rel="noopener"
        >npm</a
      >
      ·
      <a href="https://github.com/Arul1998/ngx-ai" target="_blank" rel="noopener">GitHub</a>
    </footer>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 760px;
        margin: 0 auto;
        padding: 1.5rem;
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        color: #1a1a2e;
      }
      header h1 {
        margin: 0;
        font-size: 2rem;
      }
      header p {
        margin: 0.25rem 0 1.5rem;
        color: #555;
      }
      .card {
        border: 1px solid #e3e3ee;
        border-radius: 12px;
        padding: 1.25rem;
        margin-bottom: 1.25rem;
        background: #fff;
      }
      .card h2 {
        margin: 0 0 0.75rem;
        font-size: 1.1rem;
      }
      .hint {
        margin: 0 0 1rem;
        font-size: 0.85rem;
        color: #666;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.75rem;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .muted {
        color: #999;
        font-weight: 400;
      }
      input,
      select {
        padding: 0.5rem 0.6rem;
        border: 1px solid #d0d0dd;
        border-radius: 8px;
        font: inherit;
      }
      .messages {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        min-height: 120px;
        margin-bottom: 0.75rem;
      }
      .msg {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem 0.7rem;
        border-radius: 8px;
        background: #f4f4fb;
      }
      .msg.user {
        background: #eef4ff;
      }
      .role {
        font-weight: 700;
        text-transform: capitalize;
        color: #6b46c1;
        flex: 0 0 auto;
      }
      .body {
        white-space: pre-wrap;
      }
      .composer {
        display: flex;
        gap: 0.5rem;
      }
      .composer input {
        flex: 1;
      }
      button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 8px;
        background: #6b46c1;
        color: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      button.stop {
        background: #c1466b;
      }
      button.link {
        background: none;
        color: #6b46c1;
        padding: 0.5rem 0;
        font-weight: 500;
      }
      .error {
        color: #c1466b;
        font-size: 0.85rem;
      }
      footer {
        text-align: center;
        color: #999;
        font-size: 0.85rem;
      }
      footer a {
        color: #6b46c1;
      }
    `,
  ],
})
export class App {
  protected readonly settings = inject(DemoSettings);
  protected readonly chat = injectAiChat({ system: 'You are a concise, friendly assistant.' });
  protected readonly prompt = signal('');

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setProvider(event: Event): void {
    const provider = (event.target as HTMLSelectElement).value as 'openai' | 'grok' | 'custom';
    this.settings.provider.set(provider);
  }

  protected ask(event: Event): void {
    event.preventDefault();
    const text = this.prompt().trim();
    if (!text) return;
    this.chat.stream(text);
    this.prompt.set('');
  }
}
