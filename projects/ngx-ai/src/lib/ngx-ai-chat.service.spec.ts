import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NgxAiChatService } from './ngx-ai-chat.service';
import { provideNgxAi } from './ngx-ai.config';

describe('NgxAiChatService', () => {
  let service: NgxAiChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNgxAi({ provider: 'custom', baseUrl: '/api/ai', model: 'test-model' }),
      ],
    });
    service = TestBed.inject(NgxAiChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());
  afterEach(() => vi.unstubAllGlobals());

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('POSTs to /chat/completions with the configured model and messages', () => {
    service.chat([{ role: 'user', content: 'Hi' }]).subscribe();

    const req = httpMock.expectOne('/api/ai/chat/completions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.model).toBe('test-model');
    expect(req.request.body.stream).toBe(false);
    expect(req.request.body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    req.flush({ id: '1', model: 'test-model', choices: [] });
  });

  it('maps a provider response into a ChatCompletionResponse', () => {
    let res: import('./models/chat.models').ChatCompletionResponse | undefined;
    service.chat([{ role: 'user', content: 'Hi' }]).subscribe((r) => (res = r));

    httpMock.expectOne('/api/ai/chat/completions').flush({
      id: 'abc',
      model: 'test-model',
      choices: [{ message: { role: 'assistant', content: 'Hello there' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    });

    expect(res!.id).toBe('abc');
    expect(res!.content).toBe('Hello there');
    expect(res!.finishReason).toBe('stop');
    expect(res!.usage).toEqual({ promptTokens: 3, completionTokens: 2, totalTokens: 5 });
  });

  it('maps request options to snake_case provider fields', () => {
    service
      .chat([{ role: 'user', content: 'Hi' }], { temperature: 0.2, maxTokens: 128, topP: 0.9 })
      .subscribe();

    const req = httpMock.expectOne('/api/ai/chat/completions');
    expect(req.request.body.temperature).toBe(0.2);
    expect(req.request.body.max_tokens).toBe(128);
    expect(req.request.body.top_p).toBe(0.9);
    req.flush({ id: '1', choices: [] });
  });

  it('complete() emits only the text content', () => {
    let text: string | undefined;
    service.complete('Hi').subscribe((t) => (text = t));

    httpMock.expectOne('/api/ai/chat/completions').flush({
      id: '1',
      choices: [{ message: { content: 'Yo' }, finish_reason: 'stop' }],
    });

    expect(text).toBe('Yo');
  });

  it('does not let extraBody clobber core fields (model/messages/stream)', () => {
    service
      .chat([{ role: 'user', content: 'Hi' }], {
        extraBody: { stream: true, model: 'evil', temperature: 9 },
        temperature: 0.1,
      })
      .subscribe();

    const req = httpMock.expectOne('/api/ai/chat/completions');
    expect(req.request.body.stream).toBe(false);
    expect(req.request.body.model).toBe('test-model');
    // Explicit options still win over extraBody.
    expect(req.request.body.temperature).toBe(0.1);
    req.flush({ id: '1', choices: [] });
  });

  it('wraps an HTTP error into a readable [ngx-ai] Error', () => {
    let err: unknown;
    service.chat([{ role: 'user', content: 'Hi' }]).subscribe({ error: (e) => (err = e) });

    httpMock
      .expectOne('/api/ai/chat/completions')
      .flush(
        { error: { message: 'Invalid API key' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain('[ngx-ai]');
    expect(message).toContain('401');
    expect(message).toContain('Invalid API key');
  });

  it('stream() parses CRLF-delimited SSE events split across reads', async () => {
    const sse =
      'data: {"id":"1","choices":[{"delta":{"content":"He"}}]}\r\n\r\n' +
      'data: {"choices":[{"delta":{"content":"llo"}}]}\r\n\r\n' +
      'data: [DONE]\r\n\r\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sse)));

    const deltas = await collectStream(service.stream([{ role: 'user', content: 'Hi' }]));
    expect(deltas.join('')).toBe('Hello');
  });

  it('stream() emits a final event not terminated by a blank line', async () => {
    const sse = 'data: {"choices":[{"delta":{"content":"Hi there"}}]}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(sse)));

    const deltas = await collectStream(service.stream([{ role: 'user', content: 'Hi' }]));
    expect(deltas.join('')).toBe('Hi there');
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

/** Subscribe to a stream and resolve with the collected `delta`s on completion. */
function collectStream(
  stream$: import('rxjs').Observable<import('./models/chat.models').ChatStreamChunk>,
): Promise<string[]> {
  const deltas: string[] = [];
  return new Promise((resolve, reject) => {
    stream$.subscribe({
      next: (chunk) => deltas.push(chunk.delta),
      error: reject,
      complete: () => resolve(deltas),
    });
  });
}
