// Everything the room can show. Question wording for Jev lives in lib/questions.ts.

export type Choice = { label: string; when: string };

export type Option = {
  id: string;
  ask: string;
  /** Companion yes/no: did the guest specify this at all? */
  said: string;
  choices: Record<string, Choice>;
};

export type Item = {
  id: string;
  name: string;
  /** How the item is named inside a question, e.g. "a club sandwich". */
  noun: string;
  image: string;
  emoji: string;
  dept: string;
  /** Present when the guest can ask for more than one. */
  qty?: { max: number; ask: string };
  options: Option[];
};

const COUNT_WORDS = ["one", "two", "three", "four"] as const;
export const countWord = (n: number) => COUNT_WORDS[n - 1];
export const wordCount = (w: string) => COUNT_WORDS.indexOf(w as (typeof COUNT_WORDS)[number]) + 1;

export const ITEMS: Item[] = [
  {
    id: "towels",
    name: "Bath towels",
    noun: "extra bath towels",
    image: "/items/towels.png",
    emoji: "🧺",
    dept: "Housekeeping",
    qty: { max: 4, ask: "How many bath towels does the guest want in total?" },
    options: [],
  },
  {
    id: "pillows",
    name: "Pillows",
    noun: "extra pillows",
    image: "/items/pillows.png",
    emoji: "🛏️",
    dept: "Housekeeping",
    qty: { max: 4, ask: "How many pillows does the guest want in total?" },
    options: [],
  },
  {
    id: "sandwich",
    name: "Sandwich",
    noun: "a sandwich of any kind",
    image: "/items/sandwich.png",
    emoji: "🥪",
    dept: "Kitchen",
    qty: { max: 3, ask: "How many sandwiches does the guest want in total?" },
    options: [
      {
        id: "mayo",
        ask: "Does the guest want mayonnaise on the sandwich?",
        said: "Did the guest say anything about mayonnaise?",
        choices: {
          with_mayo: { label: "Mayo", when: "The guest said nothing about mayonnaise, or asked for it." },
          no_mayo: { label: "No mayo", when: "The guest asked for the sandwich without mayonnaise." },
        },
      },
      {
        id: "side",
        ask: "Which side does the guest want with the sandwich?",
        said: "Did the guest say which side they want with the sandwich, such as fries or salad?",
        choices: {
          fries: { label: "Fries", when: "The guest said nothing about a side, or asked for fries." },
          salad: { label: "Salad", when: "The guest asked for a salad on the side." },
        },
      },
    ],
  },
  {
    id: "coffee",
    name: "Coffee",
    noun: "coffee brought to the room",
    image: "/items/coffee.png",
    emoji: "☕",
    dept: "Kitchen",
    qty: { max: 3, ask: "How many coffees does the guest want in total?" },
    options: [
      {
        id: "milk",
        ask: "Which milk does the guest want in the coffee?",
        said: "Did the guest say how they take their coffee, such as with a kind of milk or black?",
        choices: {
          whole_milk: { label: "Whole milk", when: "The guest said nothing about milk, or asked for regular milk." },
          oat_milk: { label: "Oat milk", when: "The guest asked for oat milk." },
          black: { label: "Black", when: "The guest asked for black coffee with no milk." },
        },
      },
    ],
  },
  {
    id: "wine",
    name: "Bottle of wine",
    noun: "a bottle of wine",
    image: "/items/wine.png",
    emoji: "🍷",
    dept: "Bar",
    options: [
      {
        id: "colour",
        ask: "Which wine does the guest want?",
        said: "Did the guest say whether they want red or white wine?",
        choices: {
          red: { label: "Red", when: "The guest said nothing about the kind of wine, or asked for red." },
          white: { label: "White", when: "The guest asked for white wine." },
        },
      },
    ],
  },
  {
    id: "water",
    name: "Water",
    noun: "bottled water",
    image: "/items/water.png",
    emoji: "💧",
    dept: "Kitchen",
    qty: { max: 4, ask: "How many bottles of water does the guest want in total?" },
    options: [
      {
        id: "kind",
        ask: "Which water does the guest want?",
        said: "Did the guest say whether they want sparkling or still water?",
        choices: {
          sparkling: { label: "Sparkling", when: "The guest said nothing about the kind of water, or asked for sparkling." },
          still: { label: "Still", when: "The guest asked for still or flat water." },
        },
      },
    ],
  },
  {
    id: "checkout",
    name: "Late checkout",
    noun: "a late checkout",
    image: "/items/suitcase.png",
    emoji: "🧳",
    dept: "Front desk",
    options: [
      {
        id: "time",
        ask: "What time does the guest want to check out?",
        said: "Did the guest give a time for checking out?",
        choices: {
          noon: { label: "12 PM", when: "The guest gave no time, or asked for noon." },
          one_pm: { label: "1 PM", when: "The guest asked to check out around one o'clock." },
          two_pm: { label: "2 PM", when: "The guest asked to check out around two o'clock." },
          three_pm: { label: "3 PM", when: "The guest asked to check out around three o'clock." },
        },
      },
    ],
  },
  {
    id: "wakeup",
    name: "Wake-up call",
    noun: "a wake-up call",
    image: "/items/alarm.png",
    emoji: "⏰",
    dept: "Front desk",
    options: [
      {
        id: "time",
        ask: "What time does the guest want the wake-up call?",
        said: "Did the guest give a time for the wake-up call?",
        choices: {
          six_am: { label: "6 AM", when: "The guest asked to be woken around six in the morning." },
          seven_am: { label: "7 AM", when: "The guest gave no time, or asked for seven in the morning." },
          eight_am: { label: "8 AM", when: "The guest asked to be woken around eight in the morning." },
          nine_am: { label: "9 AM", when: "The guest asked to be woken around nine in the morning." },
        },
      },
    ],
  },
  {
    id: "toiletries",
    name: "Amenity kit",
    noun: "toiletries such as a toothbrush, toothpaste or shampoo",
    image: "/items/toiletries.png",
    emoji: "🪥",
    dept: "Housekeeping",
    options: [],
  },
  {
    id: "slippers",
    name: "Slippers",
    noun: "slippers",
    image: "/items/slippers.png",
    emoji: "🥿",
    dept: "Housekeeping",
    qty: { max: 2, ask: "How many pairs of slippers does the guest want in total?" },
    options: [],
  },
];

export type PlaceKind = { name: string; image: string; emoji: string; when: string; query: string };

export const HOTEL_AREA = "Union Square, San Francisco";

export const PLACES: Record<string, PlaceKind> = {
  sushi_restaurant: {
    name: "Sushi nearby",
    image: "/items/sushi.png",
    emoji: "🍣",
    when: "The guest wants sushi or Japanese food.",
    query: "best sushi restaurant",
  },
  cocktail_bar: {
    name: "Cocktails nearby",
    image: "/items/cocktail.png",
    emoji: "🥃",
    when: "The guest wants a bar, cocktails or a drink out.",
    query: "best cocktail bar",
  },
  other_place: {
    name: "Nearby",
    image: "/items/pin.png",
    emoji: "📍",
    when: "The guest wants any other kind of place, such as another cuisine, a cafe, a shop or a sight.",
    query: "",
  },
};

export type OrderItem = { id: string; qty: number; options: Record<string, string> };
export type RouteAsk = "to_hotel" | "to_nearby_place";
export type Understanding = { items: OrderItem[]; place: string | null; route: RouteAsk | null; ms: number };
