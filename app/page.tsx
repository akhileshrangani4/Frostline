"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { ITEMS, PLACES, type Item, type OrderItem, type Understanding } from "@/lib/catalog";
import { ASSISTANT, type Block, type Card } from "@/lib/assistant";
import type { Place } from "./api/places/route";
import type { RouteResult } from "./api/route/route";

const BOOKED = /\b(booked|arranged|on (its|their) way|taken care|sent (up|that))\b/i;

/** wine + white -> /items/wine-white.png */
const variantSrc = (item: Item, choice: string) =>
  item.image.replace(".png", `-${choice.replace(/_(milk|pm|am|mayo)$|^with_/g, "")}.png`);

const post = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
};

export default function Room() {
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [finals, setFinals] = useState<string[]>([]);
  const [partial, setPartial] = useState("");
  const [jarvis, setJarvis] = useState("");
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [placeKind, setPlaceKind] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [booked, setBooked] = useState<Record<string, string>>({});
  const [ms, setMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [variants, setVariants] = useState<Set<string>>(new Set());

  const vapi = useRef<Vapi | null>(null);
  const orderRef = useRef<OrderItem[]>([]);
  const said = [...finals, partial].join(" ").trim();
  const saidRef = useRef("");
  saidRef.current = said;

  // Warm the image cache and find which option pictures exist, e.g. /items/wine-white.png.
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

  // Jev: ask about everything said so far. One request in flight, newest text wins.
  const inFlight = useRef(false);
  const waiting = useRef<string | null>(null);
  const understand = useCallback(async (text: string) => {
    if (inFlight.current) {
      waiting.current = text;
      return;
    }
    inFlight.current = true;
    try {
      const u = (await post("/api/understand", { said: text })) as Understanding;
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
    if (said) understand(said);
  }, [said, understand]);

  const drawRoute = useCallback((args: { from?: string; to?: string; mode?: string }) => {
    post("/api/route", args)
      .then((r) => setRoute(r))
      .catch(() => {});
  }, []);

  // Exa: search once each time the kind of place changes, then draw the way to the first result.
  useEffect(() => {
    if (!placeKind) {
      setPlaces(null);
      return;
    }
    let stale = false;
    setPlaces(null);
    post("/api/places", { kind: placeKind, said: saidRef.current })
      .then((data) => {
        if (stale) return;
        setPlaces(data.places);
        if (data.places[0]) drawRoute({ from: "hotel", to: data.places[0].title, mode: "walk" });
      })
      .catch((e) => !stale && setError(String(e.message ?? e)));
    return () => {
      stale = true;
    };
  }, [placeKind, drawRoute]);

  // Jarvis draws on the screen through tool calls.
  const runTool = useCallback(
    (name: string, raw: unknown) => {
      let args = raw as Record<string, unknown>;
      if (typeof raw === "string") {
        try {
          args = JSON.parse(raw);
        } catch {
          return;
        }
      }
      if (name === "show_route") drawRoute(args as { from?: string; to?: string; mode?: string });
      if (name === "show_card" && args?.title && Array.isArray(args.blocks)) {
        const card = args as unknown as Card;
        setCards((prev) => [card, ...prev.filter((c) => c.title !== card.title)].slice(0, 2));
      }
    },
    [drawRoute],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebug(params.has("debug"));
    if (params.has("demo")) {
      setPartial("send up three towels and a club sandwich no mayo and a late checkout around one and where is good sushi nearby");
      runTool("show_card", {
        title: "Rooftop pool",
        icon: "🏊",
        blocks: [
          { type: "stats", items: [{ label: "Opens", value: "6 AM" }, { label: "Closes", value: "10 PM" }, { label: "Floor", value: "14" }] },
          { type: "text", text: "Towels are provided poolside. The bar serves until sunset." },
        ],
      });
    }
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!key) {
      setError("NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set");
      return;
    }
    const v = new Vapi(key);
    vapi.current = v;
    v.on("call-start", () => {
      setLive(true);
      setConnecting(false);
    });
    v.on("call-end", () => {
      setLive(false);
      setConnecting(false);
      setSpeaking(false);
    });
    v.on("speech-start", () => setSpeaking(true));
    v.on("speech-end", () => setSpeaking(false));
    v.on("error", (e) => {
      setConnecting(false);
      setError(`Vapi: ${e?.error?.message ?? e?.message ?? JSON.stringify(e)}`);
    });
    v.on("message", (m) => {
      if (m.type === "tool-calls") {
        for (const c of m.toolCallList ?? m.toolCalls ?? []) runTool(c.function?.name, c.function?.arguments);
      } else if (m.type === "function-call") {
        runTool(m.functionCall?.name, m.functionCall?.parameters);
      } else if (m.type === "transcript" && m.role === "user") {
        if (m.transcriptType === "final") {
          setFinals((f) => [...f, m.transcript]);
          setPartial("");
        } else {
          setPartial(m.transcript);
        }
      } else if (m.type === "transcript") {
        setJarvis(m.transcript);
        if (m.transcriptType === "final" && BOOKED.test(m.transcript)) {
          setBooked(Object.fromEntries(orderRef.current.map((o) => [o.id, JSON.stringify(o)])));
        }
      }
    });
    return () => {
      v.stop();
    };
  }, [runTool]);

  // Tell Jarvis what the screen shows, so what he says matches it.
  const lastNote = useRef("");
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => {
      const requests = order.map((o) => {
        const item = ITEMS.find((i) => i.id === o.id)!;
        const details = item.options.map((opt) => o.options[opt.id] && opt.choices[o.options[opt.id]].label).filter(Boolean);
        return `${item.name}${item.qty ? ` x${o.qty}` : ""}${details.length ? ` (${details.join(", ")})` : ""}${booked[o.id] === JSON.stringify(o) ? " [booked]" : " [not yet confirmed]"}`;
      });
      const note = [
        `SCREEN: Hotel requests: ${requests.join("; ") || "none"}.`,
        places?.length ? `Nearby places shown: ${places.map((p) => `${p.title} (${p.blurb})`).join("; ")}.` : "",
        route ? `Route shown: ${route.from} to ${route.to}, ${route.minutes} minutes by ${route.mode === "walk" ? "foot" : "car"}, ${route.km} km.` : "",
        cards.length ? `Cards shown: ${cards.map((c) => c.title).join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      if (note === lastNote.current) return;
      lastNote.current = note;
      vapi.current?.send({ type: "add-message", message: { role: "system", content: note }, triggerResponseEnabled: false });
    }, 700);
    return () => clearTimeout(t);
  }, [live, order, places, route, cards, booked]);

  const toggle = () => {
    if (!vapi.current) return;
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
    setJarvis("");
    setOrder([]);
    orderRef.current = [];
    setPlaceKind(null);
    setRoute(null);
    setCards([]);
    setBooked({});
    setMs(null);
  };

  const empty = order.length === 0 && !placeKind && !route && cards.length === 0;
  const words = said.split(/\s+/).filter(Boolean);
  const freshFrom = finals.join(" ").split(/\s+/).filter(Boolean).length;

  return (
    <main className="room">
      <div className="wallpaper" aria-hidden />

      <header>
        <span className="left">
          <b>larkspur</b>
          <span>room 1204</span>
          <span>housekeeping</span>
          <span>kitchen</span>
          <span>front desk</span>
        </span>
        <span className="right">
          {ms !== null && <span>jev {ms} ms</span>}
          <Clock />
          <button onClick={reset}>clear</button>
        </span>
      </header>

      <section className="stage">
        {empty ? (
          <div className="greet">
            <span className="face">{live ? "( ^-^ )" : "( -_- )"}</span>
            <h1>good evening</h1>
            <p>what can i arrange for you?</p>
          </div>
        ) : (
          <div className="grid">
            {order.map((o) => {
              const item = ITEMS.find((i) => i.id === o.id)!;
              const src = Object.values(o.options)
                .map((c) => c && variantSrc(item, c))
                .find((v) => v && variants.has(v));
              return <Thing key={o.id} item={item} order={o} src={src || item.image} booked={booked[o.id] === JSON.stringify(o)} />;
            })}
            {placeKind && <Nearby kind={placeKind} places={places} />}
            {route && <RouteTile key={`${route.from}>${route.to}`} route={route} />}
            {cards.map((c) => (
              <CardTile key={c.title} card={c} />
            ))}
          </div>
        )}
      </section>

      <footer>
        {error && <div className="error">{error}</div>}
        <div className="chat">
          {jarvis && <p className={`bubble them ${speaking ? "speaking" : ""}`}>{jarvis.toLowerCase()}</p>}
          {words.length > 0 && (
            <p className="bubble me">
              {words.map((w, i) => (
                <span key={i} className={i >= freshFrom ? "fresh" : ""}>
                  {w.toLowerCase()}{" "}
                </span>
              ))}
            </p>
          )}
        </div>
        <button className={`aqua ${live ? "live" : ""}`} onClick={toggle}>
          <i className={speaking ? "speaking" : ""} />
          {live ? "end call" : connecting ? "connecting" : "talk to jarvis"}
        </button>
        {debug && (
          <input
            className="debug"
            placeholder="debug: type what the guest says, or /route A > B"
            onChange={(e) => {
              const v = e.target.value;
              const m = v.match(/^\/route (.+) > (.+)$/);
              if (m) return drawRoute({ from: m[1], to: m[2] });
              if (v.startsWith("/")) return;
              setFinals([]);
              setPartial(v);
            }}
          />
        )}
      </footer>
    </main>
  );
}

function Clock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);
  return <span>{now}</span>;
}

/** A little desktop window with a file name under it. */
function Win({ title, file, wide, children }: { title: string; file: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <figure className={`win ${wide ? "wide" : ""}`}>
      <div className="frame">
        <div className="titlebar">
          <i />
          <i />
          <i />
          <span>{title}</span>
        </div>
        <div className="body">{children}</div>
      </div>
      <figcaption>{file}</figcaption>
    </figure>
  );
}

function Picture({ src, emoji, count = 1 }: { src: string; emoji: string; count?: number }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [src]);
  const box = 148;
  const step = count > 1 ? 22 : 0;
  const size = box - (count - 1) * step;
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

function Thing({ item, order, src, booked }: { item: Item; order: OrderItem; src: string; booked: boolean }) {
  const details = item.options
    .map((opt) => ({ id: opt.id, picked: order.options[opt.id], label: order.options[opt.id] && opt.choices[order.options[opt.id]].label }))
    .filter((d) => d.picked);
  return (
    <Win title={item.name.toLowerCase()} file={src.split("/").pop()!}>
      {item.qty && order.qty > 1 && (
        <span className="count" key={order.qty}>
          {order.qty}
        </span>
      )}
      <Picture src={src} emoji={item.emoji} count={order.qty} />
      <div className="details">
        {details.map((d) => (
          <span key={`${d.id}-${d.picked}`}>{d.label!.toLowerCase()}</span>
        ))}
      </div>
      <p className={`status ${booked ? "done" : ""}`}>
        <i />
        {booked ? "booked" : item.dept.toLowerCase()}
      </p>
    </Win>
  );
}

function Nearby({ kind, places }: { kind: string; places: Place[] | null }) {
  const p = PLACES[kind];
  return (
    <Win wide title={p.name.toLowerCase()} file={places === null ? "searching.exa" : "nearby.exa"}>
      <ul className="places">
        {places === null && [0, 1, 2].map((i) => <li key={i} className="skeleton" />)}
        {places?.map((pl) => (
          <li key={pl.url}>
            <a href={pl.url} target="_blank" rel="noreferrer">
              {pl.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pl.image} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              ) : (
                <span className="thumb">{p.emoji}</span>
              )}
              <div>
                <strong>{pl.title.toLowerCase()}</strong>
                <span>{pl.blurb.toLowerCase()}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Win>
  );
}

function RouteTile({ route }: { route: RouteResult }) {
  const W = 340;
  const H = 190;
  const pad = 22;
  const lons = route.line.map((p) => p[0]);
  const lats = route.line.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const minX = Math.min(...lons) * kx;
  const maxY = Math.max(...lats);
  const spanX = Math.max(Math.max(...lons) * kx - minX, 1e-6);
  const spanY = Math.max(maxY - Math.min(...lats), 1e-6);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const pts = route.line.map(([lon, lat]) => [ox + (lon * kx - minX) * scale, oy + (maxY - lat) * scale]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const a = pts[0];
  const b = pts[pts.length - 1];
  return (
    <Win wide title={`to ${route.to.toLowerCase()}`} file="route.map">
      <p className="meta">
        <b>{route.minutes} min</b> {route.mode === "walk" ? "walk" : "drive"} · {route.km} km from {route.from.toLowerCase()}
      </p>
      <svg className="map" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <pattern id="blocks" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-9)">
            <path d="M34 0H0V34" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
          </pattern>
          <linearGradient id="ink" x1="0" x2="1">
            <stop offset="0" stopColor="#5ac8fa" />
            <stop offset="1" stopColor="#0a84ff" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#blocks)" />
        <path d={d} className="trail" pathLength={1} />
        <path d={d} className="path" pathLength={1} stroke="url(#ink)" />
        <circle cx={a[0]} cy={a[1]} r="5" className="from" />
        <circle cx={b[0]} cy={b[1]} r="6" className="to" />
        <circle cx={b[0]} cy={b[1]} r="6" className="ping" />
      </svg>
    </Win>
  );
}

function BlockView({ block }: { block: Block }) {
  const items = block.items ?? [];
  if (block.type === "text") return <p className="b-text">{block.text}</p>;
  if (block.type === "stats")
    return (
      <div className="b-stats">
        {items.map((it, i) => (
          <div key={i}>
            <strong>{it.value ?? it.detail}</strong>
            <span>{it.label ?? it.title}</span>
          </div>
        ))}
      </div>
    );
  if (block.type === "steps")
    return (
      <ol className="b-steps">
        {items.map((it, i) => (
          <li key={i}>
            <b>{i + 1}</b>
            <span>
              {it.title ?? it.label}
              {it.detail && <em>{it.detail}</em>}
            </span>
          </li>
        ))}
      </ol>
    );
  return (
    <ul className="b-list">
      {items.map((it, i) => (
        <li key={i}>
          <span>{it.title ?? it.label}</span>
          <em>{it.detail ?? it.value}</em>
        </li>
      ))}
    </ul>
  );
}

function CardTile({ card }: { card: Card }) {
  return (
    <Win wide title={`${card.icon ?? ""} ${card.title}`.trim().toLowerCase()} file="from-jarvis.txt">
      <div className="blocks">
        {card.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </Win>
  );
}
