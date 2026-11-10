const apiKey = process.env.EXA_API_KEY || process.env.EXA_API;

if (!apiKey) {
  throw new Error("Set EXA_API_KEY or EXA_API in vapi/.env.");
}

const queries = [
  "Palace Hotel San Francisco official rooms suites king double beds guest room categories",
  "Palace Hotel San Francisco official hotel overview contact check-in checkout parking pets pool fitness accessibility",
  "Palace Hotel San Francisco official dining Garden Court Pied Piper afternoon tea GC2GO concierge",
];

const searches = await Promise.all(queries.map(async (query) => {
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 5,
      includeDomains: ["sfpalace.com", "marriott.com"],
      contents: { text: { maxCharacters: 12000 } },
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Exa search failed (HTTP ${response.status}).`);
  }

  const { results } = await response.json();
  return results.filter(({ url }) => {
    const page = new URL(url);
    return ["sfpalace.com", "www.sfpalace.com"].includes(page.hostname)
      || (page.hostname === "www.marriott.com"
        && page.pathname.includes("/sfolc-palace-hotel-a-luxury-collection-hotel-san-francisco/"));
  });
}));

const sources = new Map(searches.flat().map(({ title, url, text }) => [
  url, { title, url, text },
]));
if (sources.size === 0) {
  throw new Error("Exa returned no official Palace Hotel sources.");
}
console.log(JSON.stringify([...sources.values()], null, 2));
