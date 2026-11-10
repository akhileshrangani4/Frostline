import { HOTEL_AREA, PLACES } from "@/lib/catalog";

export type Place = { title: string; url: string; host: string; image: string | null; blurb: string };

export async function POST(request: Request) {
  const { kind, said } = (await request.json()) as { kind: string; said: string };
  const key = process.env.EXA_API_KEY;
  if (!key) return Response.json({ error: "EXA_API_KEY is not set" }, { status: 500 });

  const base = PLACES[kind]?.query || said.split(/\s+/).slice(-25).join(" ");
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `${base} near ${HOTEL_AREA}, a specific venue's own page`,
      numResults: 3,
      type: "fast",
      contents: { summary: { query: "One short sentence on what this place is known for." } },
    }),
  });
  if (!res.ok) {
    return Response.json({ error: `Exa ${res.status}: ${await res.text()}` }, { status: 502 });
  }
  const data = await res.json();
  const places: Place[] = (data.results ?? []).map((r: Record<string, string>) => ({
    title: (r.title ?? r.url).split(/ [|\-–·] /)[0],
    url: r.url,
    host: new URL(r.url).hostname.replace(/^www\./, ""),
    image: r.image ?? null,
    blurb: r.summary ?? "",
  }));
  return Response.json({ places });
}
