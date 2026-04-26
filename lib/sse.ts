import { EventEmitter } from "node:events";

export const HEARTBEAT_MS = 25_000;

const RING_SIZE = 50;

export interface SsePayload {
  id: string;
  event: string;
  data: unknown;
}

interface EventChannel {
  emitter: EventEmitter;
  buffer: SsePayload[];
  nextId: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __luckyDrawSseChannels: Map<string, EventChannel> | undefined;
}

// Persist channels across Next.js hot-reloads in dev so an in-flight draw
// doesn't lose its subscribers when a server module reloads.
const channels = (globalThis.__luckyDrawSseChannels ??= new Map<string, EventChannel>());

function getChannel(eventId: string): EventChannel {
  let ch = channels.get(eventId);
  if (!ch) {
    const emitter = new EventEmitter();
    // Presentation mode + admin draw + any future spectators on one event:
    // the default 10-listener cap warns spuriously, raise it.
    emitter.setMaxListeners(50);
    ch = { emitter, buffer: [], nextId: 1 };
    channels.set(eventId, ch);
  }
  return ch;
}

export function publish(eventId: string, event: string, data: unknown): SsePayload {
  const ch = getChannel(eventId);
  const payload: SsePayload = { id: String(ch.nextId++), event, data };
  ch.buffer.push(payload);
  if (ch.buffer.length > RING_SIZE) ch.buffer.shift();
  ch.emitter.emit("message", payload);
  return payload;
}

export function subscribe(
  eventId: string,
  listener: (payload: SsePayload) => void,
): () => void {
  const ch = getChannel(eventId);
  ch.emitter.on("message", listener);
  return () => ch.emitter.off("message", listener);
}

// Returns payloads strictly newer than `lastEventId`. If the client's last id
// is older than the ring (or unparseable), returns [] — the snapshot endpoint
// is responsible for catching them up to the current state.
export function replayAfter(eventId: string, lastEventId: string | null): SsePayload[] {
  if (!lastEventId) return [];
  const last = Number(lastEventId);
  if (!Number.isFinite(last)) return [];
  const ch = getChannel(eventId);
  return ch.buffer.filter((p) => Number(p.id) > last);
}

export function encodeSse(payload: SsePayload): string {
  return `id: ${payload.id}\nevent: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
}

export const HEARTBEAT_FRAME = ": keepalive\n\n";
