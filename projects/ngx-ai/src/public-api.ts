/*
 * Public API Surface of ngx-ai
 */

export * from './lib/models/chat.models';
export type { AiProvider, NgxAiConfig, ResolvedNgxAiConfig } from './lib/ngx-ai.config';
export { NGX_AI_CONFIG, provideNgxAi, resolveNgxAiConfig } from './lib/ngx-ai.config';
export * from './lib/ngx-ai-chat.service';
export { SseParser } from './lib/stream/sse-parser';
export type { SseEvent } from './lib/stream/sse-parser';
