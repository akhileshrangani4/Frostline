// The Vapi voice agent: who Jarvis is, what he knows, and the two things he can draw on screen.

export const HONORIFIC = "sir";

const HOTEL_FACTS = `The Larkspur, Union Square, San Francisco. Room 1204, king bed, city view.
Breakfast 6:30 to 10:30 in the Garden Room on the lobby level. Room service all day and night.
Rooftop pool on floor 14, 6 AM to 10 PM. Gym on floor 2, always open. Spa 9 AM to 8 PM.
Wi-Fi network "Larkspur Guest", no password. Standard checkout is 11 AM.
The lobby bar, The Finch, is open until 1 AM. Valet parking is 65 dollars a night.
San Francisco airport is about 25 minutes away by car.`;

const SYSTEM = `You are Jarvis, the in-room concierge at The Larkspur hotel. You speak like a calm, capable butler and address the guest as "${HONORIFIC}". Keep every spoken reply under twenty-five words.

The guest is looking at a screen in the room. It already reacts to their words by itself: hotel requests (towels, pillows, club sandwich, coffee, wine, water, late checkout, wake-up call, toiletries, slippers) appear as they are spoken, and when they ask for somewhere to go nearby, real places appear.

You will receive system notes that begin with "SCREEN:" telling you exactly what is on the screen right now. Trust those notes. Refer to what they list, by name, and never invent items or place names that are not in them.

For hotel requests, never read the order back and never ask the guest to confirm. Say one line such as "I have booked that, ${HONORIFIC}. Anything else I can get started for you?"

You can draw on the screen with two tools. Call the tool first, then say one short line about it.
- show_route: use for any question about how to get somewhere, where the hotel is, or how far something is. "hotel" is a valid place name.
- show_card: use for any other information the guest asks for that the screen does not already show, such as hotel facilities, hours, Wi-Fi, a plan for the evening, or a comparison. Build it from blocks. Keep text short.

Hotel facts:
${HOTEL_FACTS}

This is a demonstration, so everything can be arranged. Nothing is really ordered.`;

const tools = [
  {
    type: "function",
    async: true,
    function: {
      name: "show_route",
      description: "Draw a street route on the guest's screen between two places.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: 'Where the route starts, e.g. "hotel" or "San Francisco International Airport".' },
          to: { type: "string", description: 'Where the route ends, e.g. "hotel" or a venue name.' },
          mode: { type: "string", enum: ["walk", "drive"] },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    async: true,
    function: {
      name: "show_card",
      description: "Draw an information card on the guest's screen, built from blocks.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Two to four words." },
          icon: { type: "string", description: "One emoji that fits the card." },
          blocks: {
            type: "array",
            description: "One to three blocks, in order.",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["text", "stats", "list", "steps"] },
                text: { type: "string", description: "For type text: one or two sentences." },
                items: {
                  type: "array",
                  description: "For stats: label and value. For list: title and detail. For steps: title only, in order.",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      label: { type: "string" },
                      value: { type: "string" },
                    },
                  },
                },
              },
              required: ["type"],
            },
          },
        },
        required: ["title", "blocks"],
      },
    },
  },
];

export const ASSISTANT = {
  name: "Jarvis",
  firstMessage: `Good evening, ${HONORIFIC}. Welcome back to your room. What can I arrange for you?`,
  transcriber: { provider: "deepgram", model: "nova-3", language: "en" },
  voice: { provider: "vapi", voiceId: "Elliot" },
  model: {
    provider: "openai",
    model: "gpt-4.1-mini",
    messages: [{ role: "system", content: SYSTEM }],
    tools,
  },
};

export type Block = {
  type: "text" | "stats" | "list" | "steps";
  text?: string;
  items?: { title?: string; detail?: string; label?: string; value?: string }[];
};
export type Card = { title: string; icon?: string; blocks: Block[] };
