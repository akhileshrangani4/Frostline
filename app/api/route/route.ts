// A real street route between two named places, from OpenStreetMap data. No key needed.

const HOTEL = { name: "The Larkspur", lon: -122.4075, lat: 37.7879 };
const UA = { "User-Agent": "room-concierge-demo" };

export type RouteResult = {
  from: string;
  to: string;
  mode: "walk" | "drive";
  /** [lon, lat] pairs along the streets. */
  line: [number, number][];
  minutes: number;
  km: number;
};

async function locate(name: string) {
  if (/\b(hotel|larkspur|my room|here)\b/i.test(name)) return HOTEL;
  const q = /san francisco|airport|sfo|oakland/i.test(name) ? name : `${name}, San Francisco`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&viewbox=-122.55,37.85,-122.3,37.6&q=${encodeURIComponent(q)}`;
  const hits = await (await fetch(url, { headers: UA })).json();
  if (!hits[0]) return null;
  return { name, lon: Number(hits[0].lon), lat: Number(hits[0].lat) };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { from?: string; to?: string; mode?: string };
  const [a, b] = await Promise.all([locate(body.from || "hotel"), locate(body.to || "hotel")]);
  if (!a || !b) return Response.json({ error: "Could not find that place on the map" }, { status: 404 });

  const km0 = Math.hypot((a.lon - b.lon) * 88, (a.lat - b.lat) * 111);
  const mode = body.mode === "drive" || (body.mode !== "walk" && km0 > 3) ? "drive" : "walk";
  const profile = mode === "drive" ? ["routed-car", "driving"] : ["routed-foot", "foot"];
  const res = await fetch(
    `https://routing.openstreetmap.de/${profile[0]}/route/v1/${profile[1]}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`,
    { headers: UA },
  );
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return Response.json({ error: "No route found" }, { status: 404 });

  const result: RouteResult = {
    from: a.name,
    to: b.name,
    mode,
    line: route.geometry.coordinates,
    minutes: Math.max(1, Math.round(route.duration / 60)),
    km: Math.round(route.distance / 100) / 10,
  };
  return Response.json(result);
}
