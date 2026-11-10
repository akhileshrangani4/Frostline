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
  conciergeFeed?: {
    latest: ConciergeUpdate | null;
    listeners: Set<Listener>;
  };
};

const feed = server.conciergeFeed ??= { latest: null, listeners: new Set() };

export function publishConciergeUpdate(update: Omit<ConciergeUpdate, "id">) {
  const event = { ...update, id: randomUUID() };
  feed.latest = event;
  for (const listener of feed.listeners) listener(event);
}

export function subscribeToConcierge(listener: Listener, lastEventId: string | null) {
  feed.listeners.add(listener);
  if (feed.latest && feed.latest.id !== lastEventId) listener(feed.latest);
  return () => { feed.listeners.delete(listener); };
}
