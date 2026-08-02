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
});
