import { SseParser } from './sse-parser';

describe('SseParser', () => {
  let parser: SseParser;

  beforeEach(() => {
    parser = new SseParser();
  });

  it('parses a single complete event', () => {
    const events = parser.push('data: hello\n\n');
    expect(events).toEqual([{ data: 'hello' }]);
  });

  it('parses multiple events in one push', () => {
    const events = parser.push('data: one\n\ndata: two\n\n');
    expect(events.map((e) => e.data)).toEqual(['one', 'two']);
  });

  it('reassembles an event split across pushes', () => {
    expect(parser.push('data: hel')).toEqual([]);
    expect(parser.push('lo\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ data: 'hello' }]);
  });

  it('handles CRLF line endings', () => {
    const events = parser.push('data: a\r\n\r\ndata: b\r\n\r\n');
    expect(events.map((e) => e.data)).toEqual(['a', 'b']);
  });

  it('handles a lone CR as a line terminator', () => {
    const events = parser.push('data: a\r\rdata: b\r\r');
    expect(events.map((e) => e.data)).toEqual(['a', 'b']);
  });

  it('handles a CRLF boundary split across two pushes', () => {
    expect(parser.push('data: a\r')).toEqual([]);
    const events = parser.push('\n\r\n');
    expect(events).toEqual([{ data: 'a' }]);
  });

  it('joins multiple data lines with a newline', () => {
    const events = parser.push('data: line1\ndata: line2\n\n');
    expect(events).toEqual([{ data: 'line1\nline2' }]);
  });

  it('strips exactly one leading space after the colon', () => {
    const events = parser.push('data:  two-spaces\n\n');
    expect(events[0].data).toBe(' two-spaces');
  });

  it('treats a value with no leading space verbatim', () => {
    const events = parser.push('data:nospace\n\n');
    expect(events[0].data).toBe('nospace');
  });

  it('ignores comment lines', () => {
    const events = parser.push(': this is a keep-alive\ndata: real\n\n');
    expect(events).toEqual([{ data: 'real' }]);
  });

  it('ignores an event made only of comments', () => {
    const events = parser.push(': ping\n\n');
    expect(events).toEqual([]);
  });

  it('parses event, id and retry fields', () => {
    const events = parser.push('event: update\nid: 42\nretry: 3000\ndata: x\n\n');
    expect(events[0]).toEqual({ event: 'update', id: '42', retry: 3000, data: 'x' });
  });

  it('ignores an invalid retry value', () => {
    const events = parser.push('retry: soon\ndata: x\n\n');
    expect(events[0].retry).toBeUndefined();
  });

  it('treats a field line with no colon as an empty value', () => {
    const events = parser.push('data\n\n');
    expect(events).toEqual([{ data: '' }]);
  });

  it('ignores unknown fields', () => {
    const events = parser.push('foo: bar\ndata: x\n\n');
    expect(events[0]).toEqual({ data: 'x' });
  });

  it('does not emit a trailing partial event until flushed', () => {
    expect(parser.push('data: partial')).toEqual([]);
    expect(parser.flush()).toEqual([{ data: 'partial' }]);
  });

  it('flush emits nothing when the buffer is empty', () => {
    parser.push('data: done\n\n');
    expect(parser.flush()).toEqual([]);
  });

  it('flush emits nothing for a trailing blank buffer', () => {
    parser.push('data: done\n\n');
    parser.push('\n');
    expect(parser.flush()).toEqual([]);
  });

  it('parses a realistic OpenAI-style delta payload', () => {
    const raw =
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Hi"}}]}\n\n' + 'data: [DONE]\n\n';
    const events = parser.push(raw);
    expect(events).toHaveLength(2);
    expect(JSON.parse(events[0].data).choices[0].delta.content).toBe('Hi');
    expect(events[1].data).toBe('[DONE]');
  });
});
