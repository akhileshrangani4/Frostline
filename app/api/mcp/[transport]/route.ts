import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { publishConciergeUpdate } from "@/lib/live";
import { findPlaces } from "@/lib/places";
import { understandGuest } from "@/lib/understand";

const LOCATION = "within walking distance of 2 New Montgomery Street, San Francisco, California";
const HOTEL_DOMAINS = ["sfpalace.com", "piedpipersf.com", "gardencourtsf.com"];

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "ask_concierge",
      {
        title: "Ask the hotel concierge",
        description: "Find restaurants, bars, cafés, shops or sights near the Palace Hotel in San Francisco and return a shareable visual results link.",
        inputSchema: { text: z.string().trim().min(1).max(500).describe("The guest’s request") },
      },
      async ({ text }) => {
        try {
          const { understood } = await understandGuest(text, "text");
          const kind = understood.place;
          if (!kind) return textResult("I can help find a restaurant, bar, café, shop, or sight near the hotel.");

          const places = await findPlaces(kind, text, LOCATION, HOTEL_DOMAINS);
          const update = publishConciergeUpdate({ kind, places, ms: understood.ms });
          const base = process.env.CONCIERGE_PUBLIC_URL;
          const path = `/share/${update.id}`;
          const share = base && URL.canParse(path, base) ? new URL(path, base) : null;
          const visual = share?.protocol === "https:" ? `Open the visual results: ${share.href}` : null;

          if (places.length === 0) return textResult("I couldn’t find a matching place near the hotel.");
          return textResult(
            [...(visual ? [visual, ""] : []), "Here are a few options near the Palace Hotel:", ...places.map((place, index) =>
              `${index + 1}. ${place.title}${place.blurb ? ` — ${place.blurb}` : ""}\n${place.url}`,
            )].join("\n"),
          );
        } catch (error) {
          console.error("Concierge lookup failed:", error instanceof Error ? error.message : error);
          return textResult("The concierge lookup is temporarily unavailable.", true);
        }
      },
    );
  },
  { serverInfo: { name: "hotel-concierge", version: "1.0.0" } },
  { basePath: "/api/mcp", disableSse: true },
);

export { handler as GET, handler as POST, handler as DELETE };
