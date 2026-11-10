"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { ITEMS, PLACES, type Item, type OrderItem, type Understanding } from "@/lib/catalog";
import type { ConciergeUpdate } from "@/lib/live";
import type { Place } from "@/lib/places";

/** How Jarvis addresses the guest. */
const HONORIFIC = "sir";

const ASSISTANT = {
  name: "Jarvis",
  firstMessage: `Good evening, ${HONORIFIC}. Welcome back to your room. What can I arrange for you?`,
  transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
  voice: { provider: "vapi", voiceId: "Elliot" },
  model: {
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `You are Jarvis, the in-room concierge at The Larkspur hotel near Union Square, San Francisco. You speak like a calm, capable butler and address the guest as "${HONORIFIC}".

The guest sees a screen in the room that shows each request as they say it, so never read the order back in full and never ask the guest to repeat or confirm details.

When the guest asks for things from the hotel (towels, pillows, food, drinks, late checkout, a wake-up call, toiletries, slippers), reply with exactly one short line such as "I have booked that, ${HONORIFIC}. Anything else I can get started for you?"

When the guest asks for somewhere to go nearby, say one short line such as "I have put a few good options on your screen, ${HONORIFIC}." Do not invent place names.

Keep every reply under twenty words. This is a demonstration, so everything can be arranged.`,
      },
    ],
  },
};

const BOOKED = /\b(booked|arranged|on (its|their) way|taken care|sent (up|that))\b/i;

export default function Room() {
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [finals, setFinals] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [placeKind, setPlaceKind] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [museUpdate, setMuseUpdate] = useState<ConciergeUpdate | null>(null);
  const [booked, setBooked] = useState<Record<string, string>>({});
  const [ms, setMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);

  // Variant pictures that exist on disk, e.g. /items/wine-white.png. Also warms the image cache.
  const [variants, setVariants] = useState<Set<string>>(new Set());
  useEffect(() => {
    const load = (src: string, onOk?: () => void) => {
      const img = new Image();
      if (onOk) img.onload = onOk;
      img.src = src;
    };
    Object.values(PLACES).forEach((p) => load(p.image));
    for (const item of ITEMS) {
      load(item.image);
      for (const opt of item.options)
        for (const choice of Object.keys(opt.choices)) {
          const src = variantSrc(item, choice);
          load(src, () => setVariants((v) => new Set(v).add(src)));
        }
    }
  }, []);

  const vapi = useRef<Vapi | null>(null);
  const orderRef = useRef<OrderItem[]>([]);
  const said = [...finals, partial].join(" ").trim();

  // Ask Jev about everything said so far. One request in flight, newest text wins.
  const inFlight = useRef(false);
  const waiting = useRef<string | null>(null);
  const understand = useCallback(async (text: string) => {
    if (inFlight.current) {
      waiting.current = text;
      return;
    }
    inFlight.current = true;
    try {
      const res = await fetch("/api/understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ said: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const u = data as Understanding;
      orderRef.current = u.items;
      setOrder(u.items);
      setPlaceKind(u.place);
      setMs(u.ms);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      inFlight.current = false;
      const next = waiting.current;
      waiting.current = null;
      if (next !== null) understand(next);
    }
  }, []);

  useEffect(() => {
    if (said) {
      setMuseUpdate(null);
      understand(said);
    }
  }, [said, understand]);

  // Exa: search once each time the kind of place changes.
  const saidRef = useRef("");
  saidRef.current = said;
  useEffect(() => {
    if (!placeKind) {
      setPlaces(null);
      return;
    }
    let stale = false;
    setPlaces(null);
    fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: placeKind, said: saidRef.current }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!stale) setPlaces(data.places);
      })
      .catch((e) => !stale && setError(String(e.message ?? e)));
    return () => {
      stale = true;
    };
  }, [placeKind]);

  useEffect(() => {
    const feed = new EventSource("/api/live");
    feed.onmessage = (event) => setMuseUpdate(JSON.parse(event.data) as ConciergeUpdate);
    return () => feed.close();
  }, []);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!key) return;
    const v = new Vapi(key);
    vapi.current = v;
    v.on("call-start", () => {
      setLive(true);
      setConnecting(false);
    });
    v.on("call-end", () => {
      setLive(false);
      setConnecting(false);
    });
    v.on("error", (e) => {
      setConnecting(false);
      setError(`Vapi: ${e?.error?.message ?? e?.message ?? JSON.stringify(e)}`);
    });
    v.on("message", (m) => {
      if (m.type !== "transcript") return;
      if (m.role === "user") {
        if (m.transcriptType === "final") {
          setFinals((f) => [...f, m.transcript]);
          setPartial("");
        } else {
          setPartial(m.transcript);
        }
      } else if (m.transcriptType === "final" && BOOKED.test(m.transcript)) {
        setBooked(Object.fromEntries(orderRef.current.map((o) => [o.id, JSON.stringify(o)])));
      }
    });
    return () => {
      v.stop();
    };
  }, []);

  const toggle = () => {
    if (!vapi.current) {
      setError("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set");
      return;
    }
    if (live || connecting) {
      vapi.current.stop();
      return;
    }
    setConnecting(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vapi.current.start(ASSISTANT as any);
  };

  const reset = () => {
    setFinals([]);
    setPartial("");
    setOrder([]);
    orderRef.current = [];
    setPlaceKind(null);
    setMuseUpdate(null);
    setBooked({});
    setMs(null);
  };

  const visibleKind = museUpdate?.kind ?? placeKind;
  const visiblePlaces = museUpdate ? museUpdate.places : places;
  const visibleMs = museUpdate?.ms ?? ms;
  const empty = order.length === 0 && !visibleKind;
  const words = museUpdate ? [] : said.split(/\s+/).filter(Boolean);
  const freshFrom = finals.join(" ").split(/\s+/).filter(Boolean).length;

  return (
    <main className="room">
      <header>
        <span>Room 1204</span>
        <button className="ghost" onClick={reset}>
          Clear
        </button>
      </header>

      <section className="stage">
        {empty ? (
          <h1 className="greet">What can I arrange for you?</h1>
        ) : (
          <div className="tray">
            {order.map((o) => {
              const item = ITEMS.find((i) => i.id === o.id)!;
              const src = Object.values(o.options).map((c) => c && variantSrc(item, c)).find((v) => v && variants.has(v));
              return <Thing key={o.id} item={item} order={o} src={src || item.image} booked={booked[o.id] === JSON.stringify(o)} />;
            })}
            {visibleKind && <Nearby kind={visibleKind} places={visiblePlaces} />}
          </div>
        )}
      </section>

      <footer>
        {error && <div className="error">{error}</div>}
        <div className="dock">
          <div className="bar">
            <div className="said">
              {words.length === 0 && <span className="hint">{museUpdate ? "Muse concierge request" : live ? "Listening…" : "Tap the button and start talking"}</span>}
              {words.map((w, i) => (
                <span key={i} className={i >= freshFrom ? "fresh" : ""}>
                  {w}{" "}
                </span>
              ))}
            </div>
            {visibleMs !== null && <span className="ms">{visibleMs} ms</span>}
          </div>
          <button className={`orb ${live ? "live" : ""} ${connecting ? "wait" : ""}`} onClick={toggle} aria-label={live ? "End call" : "Start call"}>
            <i />
          </button>
        </div>
        {debug && (
          <input
            className="debug"
            placeholder="debug: type what the guest says"
            onChange={(e) => {
              setFinals([]);
              setPartial(e.target.value);
            }}
          />
        )}
      </footer>
    </main>
  );
}

/** wine + white -> /items/wine-white.png */
const variantSrc = (item: Item, choice: string) => item.image.replace(".png", `-${choice.replace(/_(milk|pm|am|mayo)$|^with_/g, "")}.png`);

function Picture({ src, emoji, count = 1 }: { src: string; emoji: string; count?: number }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [src]);
  const step = count > 1 ? 30 : 0;
  const size = 200 - (count - 1) * step;
  return (
    <div className="pic">
      {missing ? (
        <span className="stand-in">{emoji}</span>
      ) : (
        Array.from({ length: count }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={src}
            alt=""
            onError={() => setMissing(true)}
            style={{ width: size, height: size, left: i * step, top: (count - 1 - i) * step }}
          />
        ))
      )}
    </div>
  );
}

function Row({ lit, total, label }: { lit: number[]; total: number; label: string }) {
  return (
    <div className="row" key={label}>
      <span className="pips">
        {Array.from({ length: total }, (_, i) => (
          <b key={i} className={lit.includes(i) ? "on" : ""} />
        ))}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

function Thing({ item, order, src, booked }: { item: Item; order: OrderItem; src: string; booked: boolean }) {
  return (
    <article className="thing">
      <Picture src={src} emoji={item.emoji} count={order.qty} />
      <h2>{item.name}</h2>
      <div className="rows">
        {item.qty && (
          <Row
            key={`qty-${order.qty}`}
            lit={Array.from({ length: order.qty }, (_, i) => i)}
            total={item.qty.max}
            label={`× ${order.qty}`}
          />
        )}
        {item.options.map((opt) => {
          const keys = Object.keys(opt.choices);
          const picked = order.options[opt.id];
          if (!picked) return null;
          return <Row key={`${opt.id}-${picked}`} lit={[keys.indexOf(picked)]} total={keys.length} label={opt.choices[picked].label} />;
        })}
      </div>
      <p className={`status ${booked ? "done" : ""}`}>{booked ? `Booked · ${item.dept}` : item.dept}</p>
    </article>
  );
}

function Nearby({ kind, places }: { kind: string; places: Place[] | null }) {
  const p = PLACES[kind];
  return (
    <article className="thing nearby">
      <Picture src={p.image} emoji={p.emoji} />
      <h2>{p.name}</h2>
      <ul className="places">
        {places === null && <li className="searching">Searching the neighbourhood…</li>}
        {places?.length === 0 && <li className="searching">No matching places found.</li>}
        {places?.map((pl) => (
          <li key={pl.url}>
            <a href={pl.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {pl.image && <img src={pl.image} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />}
              <div>
                <strong>{pl.title}</strong>
                {pl.blurb && <span>{pl.blurb}</span>}
                <em>{pl.host}</em>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
