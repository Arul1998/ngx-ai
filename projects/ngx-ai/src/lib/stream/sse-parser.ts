/**
 * A minimal, dependency-free parser for the Server-Sent Events (SSE) wire
 * format, as used by OpenAI-compatible streaming chat APIs.
 *
 * It is deliberately transport-agnostic: feed it decoded text as it arrives
 * (in whatever chunk sizes the network hands you) via {@link SseParser.push},
 * and it returns the events that have become complete. Call
 * {@link SseParser.flush} once the stream ends to surface any trailing event
 * that was not terminated by a blank line.
 *
 * The parser follows the WHATWG event-stream rules that matter in practice:
 * - `\r\n`, `\r` and `\n` are all accepted as line terminators.
 * - Events are separated by a blank line.
 * - Lines beginning with `:` are comments and ignored.
 * - A line is split into `field` / `value` at the first `:`; a single leading
 *   space in the value is removed. A line with no `:` is a field with an empty
 *   value.
 * - Multiple `data:` lines within one event are joined with `\n`.
 */
export interface SseEvent {
  /** The `event:` field, when present (defaults to `'message'` upstream). */
  event?: string;
  /** The accumulated `data:` payload (multiple lines joined with `\n`). */
  data: string;
  /** The `id:` field, when present. */
  id?: string;
  /** The `retry:` field parsed as an integer, when present and valid. */
  retry?: number;
}

export class SseParser {
  private buffer = '';

  /**
   * Feed a chunk of decoded text into the parser and return every event that
   * is now complete. Partial events are retained until a later `push`/`flush`.
   */
  push(chunk: string): SseEvent[] {
    // Normalize all line endings to `\n` so boundary detection is uniform.
    this.buffer += chunk.replace(/\r\n?/g, '\n');

    const events: SseEvent[] = [];
    let boundary: number;
    while ((boundary = this.buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const event = parseEvent(rawEvent);
      if (event) events.push(event);
    }
    return events;
  }

  /**
   * Emit any buffered event that was not terminated by a trailing blank line,
   * then reset. Call this exactly once, after the underlying stream is done.
   */
  flush(): SseEvent[] {
    const remaining = this.buffer;
    this.buffer = '';
    const event = parseEvent(remaining);
    return event ? [event] : [];
  }
}

/** Parse a single raw event block (the text between blank lines) into an event. */
function parseEvent(rawEvent: string): SseEvent | null {
  const lines = rawEvent.split('\n');
  const dataParts: string[] = [];
  let event: string | undefined;
  let id: string | undefined;
  let retry: number | undefined;
  let sawField = false;

  for (const line of lines) {
    // Comment line, or an empty line inside the block: ignore.
    if (line === '' || line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    // Strip a single leading space from the value.
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        dataParts.push(value);
        sawField = true;
        break;
      case 'event':
        event = value;
        sawField = true;
        break;
      case 'id':
        id = value;
        sawField = true;
        break;
      case 'retry': {
        const n = Number(value);
        if (Number.isInteger(n)) retry = n;
        sawField = true;
        break;
      }
      default:
        // Unknown field: ignored per spec.
        break;
    }
  }

  if (!sawField) return null;

  const parsed: SseEvent = { data: dataParts.join('\n') };
  if (event !== undefined) parsed.event = event;
  if (id !== undefined) parsed.id = id;
  if (retry !== undefined) parsed.retry = retry;
  return parsed;
}
