import { STREAM_DONE, chatChunkFromSseData } from './chat-stream';

describe('chatChunkFromSseData', () => {
  it('maps a delta payload to a ChatStreamChunk', () => {
    const chunk = chatChunkFromSseData(
      '{"id":"c1","model":"gpt","choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}',
      'fallback',
    );
    expect(chunk).toEqual({
      id: 'c1',
      model: 'gpt',
      delta: 'Hi',
      finishReason: null,
      raw: expect.any(Object),
    });
  });

  it('returns STREAM_DONE for the [DONE] sentinel', () => {
    expect(chatChunkFromSseData('[DONE]', 'fallback')).toBe(STREAM_DONE);
  });

  it('trims surrounding whitespace before matching [DONE]', () => {
    expect(chatChunkFromSseData('  [DONE]  ', 'fallback')).toBe(STREAM_DONE);
  });

  it('returns null for empty data', () => {
    expect(chatChunkFromSseData('', 'fallback')).toBeNull();
    expect(chatChunkFromSseData('   ', 'fallback')).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(chatChunkFromSseData('{not json', 'fallback')).toBeNull();
  });

  it('falls back to the configured model when the payload omits one', () => {
    const chunk = chatChunkFromSseData('{"choices":[{"delta":{"content":"x"}}]}', 'fallback');
    expect(chunk).not.toBeNull();
    expect(chunk).not.toBe(STREAM_DONE);
    if (chunk && chunk !== STREAM_DONE) expect(chunk.model).toBe('fallback');
  });

  it('emits an empty delta for a chunk that carries only a finish_reason', () => {
    const chunk = chatChunkFromSseData('{"choices":[{"delta":{},"finish_reason":"stop"}]}', 'm');
    expect(chunk).not.toBe(STREAM_DONE);
    if (chunk && chunk !== STREAM_DONE) {
      expect(chunk.delta).toBe('');
      expect(chunk.finishReason).toBe('stop');
    }
  });
});
