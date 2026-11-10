# Frostline

A voice concierge for the hotel room. Ask Jarvis for towels, a sandwich or a late checkout and each request appears on screen while you are still mid-sentence. Corrections and removals update live, nearby places come from a real search, and directions are drawn as a route.

Live: https://vapihack.vercel.app

## How it works

- **Vapi** runs the voice call and streams partial transcripts to the page.
- **TypeSafe Jev** reads everything said so far on every partial and answers typed questions (what is wanted, how many, which options) in about 100 to 200 ms. The screen is recomputed from those answers, so "make it three" and "get rid of the coffee" just work.
- **Exa** finds real places near the hotel when the guest asks for somewhere to go.
- Routes use OpenStreetMap (Nominatim and OSRM). Jarvis can also draw info cards and routes through tool calls.

Nothing is really booked. It is a demo.

## Layout

- `lib/catalog.ts`: everything the room can show
- `lib/questions.ts`: Jev question wording and thresholds
- `lib/assistant.ts`: the Vapi assistant, its prompt and tools
- `app/api/understand`, `app/api/places`, `app/api/route`: Jev, Exa and routing
- `app/page.tsx`: the screen

## Run it

```bash
pnpm install
pnpm dev
```

`.env.local` needs `TYPESAFE_API_KEY`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY` and `EXA_API_KEY`.

Add `?debug` to type instead of talking, or `?demo` for a filled screen.
