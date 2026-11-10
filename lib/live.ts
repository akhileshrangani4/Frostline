import { randomUUID } from "node:crypto";
import type { Place } from "./places";

export type ConciergeUpdate = {
  id: string;
  kind: string;
  places: Place[];
  ms: number;
};

type Listener = (update: ConciergeUpdate) => void;

const server = globalThis as typeof globalThis & {
  conciergeShares?: Map<string, { event: ConciergeUpdate; expiresAt: number }>;
  conciergeFeed?: {
    latest: ConciergeUpdate | null;
    listeners: Set<Listener>;
  };
};

const feed = server.conciergeFeed ??= { latest: null, listeners: new Set() };

const shares = server.conciergeShares ??= new Map();
const SHARE_TTL_MS = 60 * 60 * 1000;
const MAX_SHARES = 50;

export function getConciergeShare(id: string) {
  const share = shares.get(id);
  if (!share || share.expiresAt <= Date.now()) return null;
  return share.event;
}

export function publishConciergeUpdate(update: Omit<ConciergeUpdate, "id">) {
  const event = { ...update, id: randomUUID() };
  shares.set(event.id, { event, expiresAt: Date.now() + SHARE_TTL_MS });
  if (shares.size > MAX_SHARES) {
    const oldest = shares.keys().next();
    if (!oldest.done) shares.delete(oldest.value);
  }
  feed.latest = event;
  for (const listener of feed.listeners) listener(event);
  return event;
}

export function subscribeToConcierge(listener: Listener, lastEventId: string | null) {
  feed.listeners.add(listener);
  if (feed.latest && feed.latest.id !== lastEventId) listener(feed.latest);
  return () => { feed.listeners.delete(listener); };
}
