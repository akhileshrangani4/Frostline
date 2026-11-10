import { HOTEL_AREA, PLACES } from "./catalog";
import { ConciergeError } from "./understand";

export type Place = { title: string; url: string; host: string; image: string | null; blurb: string };

const GUIDE_DOMAINS = ["exa.ai", "gayot.com", "wanderboat.ai", "timeout.com", "yelp.com", "tripadvisor.com", "eater.com", "theinfatuation.com", "reddit.com", "bartender.com", "secretsanfrancisco.com", "theworlds50best.com", "opentable.com", "sfgate.com", "whodoyou.com", "roadtrippers.com", "thrillist.com", "foursquare.com", "wikipedia.org", "instagram.com", "facebook.com"];

export async function findPlaces(
  kind: string,
  said: string,
  location = `in ${HOTEL_AREA}, California`,
  omitDomains: string[] = [],
): Promise<Place[]> {
  const key = process.env.EXA_API_KEY || process.env.EXA_API;
  if (!key) throw new ConciergeError("EXA_API_KEY is not set", 500);

  // Search on what the guest actually asked for, so "quiet" or "pizza" carry through.
  const excludeDomains = [...GUIDE_DOMAINS, ...omitDomains];
  const asked = said.split(/\s+/).slice(-20).join(" ");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `${PLACES[kind]?.query || asked} ${location}, official website of one venue`,
      numResults: 10,
      // Guides and listicles, so results are the venues' own pages.
      excludeDomains,
      type: "fast",
      contents: {
        summary: {
          query: "The venue's name and what it is known for.",
          schema: {
            type: "object",
            properties: {
              venue_name: { type: "string", description: "The name of the single venue this page belongs to. Empty if the page is a list or article." },
              known_for: { type: "string", description: "At most twelve words on what the venue is known for." },
              one_venue: { type: "boolean", description: "True only if the whole page is about one restaurant, bar or shop. False for lists, guides, rankings and articles covering several places." },
            },
            required: ["venue_name", "known_for", "one_venue"],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new ConciergeError(`Exa ${res.status}: ${await res.text()}`, 502);
  }
  const data = await res.json();
  const places: Place[] = [];
  for (const r of (data.results ?? []) as Record<string, string>[]) {
    let info: { venue_name?: string; known_for?: string; one_venue?: boolean } = {};
    try {
      info = JSON.parse(r.summary);
    } catch {}
    if (!info.venue_name || !info.one_venue || info.venue_name.length > 40 || places.some((p) => p.title.toLowerCase() === info.venue_name!.toLowerCase())) continue;
    const url = URL.canParse(r.url) ? new URL(r.url) : null;
    if (!url || !["http:", "https:"].includes(url.protocol)) continue;
    const host = url.hostname.replace(/^www\./, "");
    if (excludeDomains.includes(host) || places.some((place) => place.host === host)) continue;
    places.push({
      title: info.venue_name,
      url: r.url,
      host,
      image: r.image ?? null,
      blurb: info.known_for ?? "",
    });
    if (places.length === 3) break;
  }
  return places;
}
