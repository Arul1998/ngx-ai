/**
 * The error type thrown by {@link NgxAiChatService} for every failed request,
 * whether it originates from `HttpClient` (non-streaming) or `fetch`
 * (streaming). Lets callers branch on `error instanceof NgxAiError` and inspect
 * the HTTP `status` uniformly.
 */
export class NgxAiError extends Error {
  /** The HTTP status code, when the failure carried one (`0` for network errors). */
  readonly status?: number;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'NgxAiError';
    this.status = options.status;
    // Restore the prototype chain for reliable `instanceof` across targets.
    Object.setPrototypeOf(this, NgxAiError.prototype);
  }
}
