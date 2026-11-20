export interface SSEEvent {
  event: string;
  data: string;
}
export function parseSSE(stream: AsyncIterable<Uint8Array>): AsyncGenerator<SSEEvent>;
export function streamText(stream: AsyncIterable<Uint8Array>, onDelta?: (delta: string) => void): Promise<string>;
