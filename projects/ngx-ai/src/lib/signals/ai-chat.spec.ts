import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AiChat, injectAiChat } from './ai-chat';
import { provideNgxAi } from '../ngx-ai.config';

describe('injectAiChat', () => {
  let httpMock: HttpTestingController;
  let injector: EnvironmentInjector;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgxAi({ provider: 'custom', baseUrl: '/api/ai', model: 'test-model' }),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    injector = TestBed.inject(EnvironmentInjector);
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  const create = (...args: Parameters<typeof injectAiChat>): AiChat =>
    runInInjectionContext(injector, () => injectAiChat(...args));

  it('starts empty with idle state', () => {
    const chat = create();
    expect(chat.messages()).toEqual([]);
    expect(chat.response()).toBe('');
    expect(chat.loading()).toBe(false);
    expect(chat.streaming()).toBe(false);
    expect(chat.error()).toBeNull();
  });

  it('seeds a system prompt when configured', () => {
    const chat = create({ system: 'Be brief.' });
    expect(chat.messages()).toEqual([{ role: 'system', content: 'Be brief.' }]);
  });

  it('send() appends the user message, toggles loading, and stores the reply', () => {
    const chat = create();
    chat.send('Hi');

    expect(chat.loading()).toBe(true);
    expect(chat.messages()).toEqual([{ role: 'user', content: 'Hi' }]);

    const req = httpMock.expectOne('/api/ai/chat/completions');
    expect(req.request.body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    req.flush({ id: '1', choices: [{ message: { content: 'Hello!' }, finish_reason: 'stop' }] });

    expect(chat.loading()).toBe(false);
    expect(chat.response()).toBe('Hello!');
    expect(chat.messages()).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]);
  });

  it('send() records an error and clears loading on failure', () => {
    const chat = create();
    chat.send('Hi');

    httpMock
      .expectOne('/api/ai/chat/completions')
      .flush({ error: { message: 'nope' } }, { status: 500, statusText: 'Server Error' });

    expect(chat.loading()).toBe(false);
    expect(chat.error()).toBeInstanceOf(Error);
    expect(chat.error()!.message).toContain('[ngx-ai]');
  });

  it('stream() accumulates deltas into the live assistant message', async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"He"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n' +
      'data: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sse)));

    const chat = create();
    chat.stream('Hi');
    expect(chat.streaming()).toBe(true);

    await waitFor(() => !chat.streaming());

    expect(chat.response()).toBe('Hello');
    expect(chat.messages()).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]);
    expect(chat.error()).toBeNull();
  });

  it('reset() restores the seeded state and clears errors', () => {
    const chat = create({ system: 'sys' });
    chat.send('Hi');
    httpMock
      .expectOne('/api/ai/chat/completions')
      .flush({ id: '1', choices: [{ message: { content: 'yo' } }] });

    chat.reset();
    expect(chat.messages()).toEqual([{ role: 'system', content: 'sys' }]);
    expect(chat.error()).toBeNull();
    expect(chat.loading()).toBe(false);
  });
});

/** Build a minimal streaming `Response` whose body yields `text` in small chunks. */
function sseResponse(text: string, chunkSize = 7): Response {
  const bytes = new TextEncoder().encode(text);
  let pos = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pos >= bytes.length) {
        controller.close();
        return;
      }
      const end = Math.min(pos + chunkSize, bytes.length);
      controller.enqueue(bytes.slice(pos, end));
      pos = end;
    },
  });
  return { ok: true, status: 200, statusText: 'OK', body } as unknown as Response;
}

/** Poll until `predicate` is true or a short timeout elapses. */
async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}
