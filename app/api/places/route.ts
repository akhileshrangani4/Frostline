import { HOTEL_AREA, PLACES } from "@/lib/catalog";

export type Place = { title: string; url: string; host: string; image: string | null; blurb: string };

export async function POST(request: Request) {
  const { kind, said } = (await request.json()) as { kind: string; said: string };
  const key = process.env.EXA_API_KEY;
  if (!key) return Response.json({ error: "EXA_API_KEY is not set" }, { status: 500 });

  // Search on what the guest actually asked for, so "quiet" or "pizza" carry through.
  const asked = said.split(/\s+/).slice(-20).join(" ");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `${PLACES[kind]?.query || asked} in ${HOTEL_AREA}, California`,
      numResults: 8,
      // Guides and listicles, so results are the venues' own pages.
      excludeDomains: ["timeout.com", "yelp.com", "tripadvisor.com", "eater.com", "theinfatuation.com", "reddit.com", "bartender.com", "secretsanfrancisco.com", "theworlds50best.com", "opentable.com", "sfgate.com", "whodoyou.com", "roadtrippers.com", "thrillist.com", "foursquare.com", "wikipedia.org", "instagram.com", "facebook.com"],
      type: "fast",
      contents: {
        summary: {
          query: "The venue's name and what it is known for.",
          schema: {
            type: "object",
            properties: {
              venue_name: { type: "string", description: "The name of the single venue this page belongs to. Empty if the page is a list or article." },
              known_for: { type: "string", description: "At most twelve words on what the venue is known for." },
            },
            required: ["venue_name", "known_for"],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    return Response.json({ error: `Exa ${res.status}: ${await res.text()}` }, { status: 502 });
  }
  const data = await res.json();
  const places: Place[] = [];
  for (const r of (data.results ?? []) as Record<string, string>[]) {
    let info: { venue_name?: string; known_for?: string } = {};
    try {
      info = JSON.parse(r.summary);
    } catch {}
    if (!info.venue_name || places.some((p) => p.title.toLowerCase() === info.venue_name!.toLowerCase())) continue;
    places.push({
      title: info.venue_name,
      url: r.url,
      host: new URL(r.url).hostname.replace(/^www\./, ""),
      image: r.image ?? null,
      blurb: info.known_for ?? "",
    });
    if (places.length === 3) break;
  }
  return Response.json({ places });
}
