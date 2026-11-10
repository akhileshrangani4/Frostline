// All Jev question wording and thresholds live here.
import { ITEMS, PLACES, countWord, wordCount, type OrderItem, type Understanding } from "./catalog";

type Question =
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

type Answer = { type: string; noul?: number; choice?: string };

/** Above this a Noul reads as yes. */
const YES = 0.6;

export function buildQuestions(): Record<string, Question> {
  const q: Record<string, Question> = {};

  for (const item of ITEMS) {
    q[`${item.id}.want`] = {
      type: "noul",
      instructions: `Does the guest currently want ${item.noun}?`,
      criteria: {
        true: `The guest asked for ${item.noun} and has not taken the request back.`,
        false: `The guest has not asked for ${item.noun}, or asked and then cancelled or removed it.`,
      },
    };
    if (item.qty) {
      const criteria: Record<string, string> = {};
      for (let n = 1; n <= item.qty.max; n++) {
        criteria[countWord(n)] =
          n === 1
            ? "The guest gave no number, or settled on one."
            : `The number the guest settled on, after any correction, is ${countWord(n)}.`;
      }
      q[`${item.id}.qty`] = { type: "choice", instructions: item.qty.ask, criteria };
    }
    for (const opt of item.options) {
      q[`${item.id}.${opt.id}`] = {
        type: "choice",
        instructions: opt.ask,
        criteria: Object.fromEntries(Object.entries(opt.choices).map(([k, c]) => [k, c.when])),
      };
    }
  }

  q["place.want"] = {
    type: "noul",
    instructions: "Is the guest asking for a recommendation of somewhere to go outside the hotel?",
    criteria: {
      true: "The guest asked where to find a restaurant, bar, cafe, shop or sight nearby.",
      false: "The guest only asked for things to be brought to the room or arranged by the hotel.",
    },
  };
  q["place.kind"] = {
    type: "choice",
    instructions: "What kind of place outside the hotel is the guest looking for?",
    criteria: Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, p.when])),
  };

  return q;
}

export function readAnswers(answers: Record<string, Answer>, ms: number): Understanding {
  const items: OrderItem[] = [];
  for (const item of ITEMS) {
    if ((answers[`${item.id}.want`]?.noul ?? 0) < YES) continue;
    const options: Record<string, string> = {};
    for (const opt of item.options) {
      const picked = answers[`${item.id}.${opt.id}`]?.choice;
      options[opt.id] = picked && picked in opt.choices ? picked : Object.keys(opt.choices)[0];
    }
    const qty = item.qty ? wordCount(answers[`${item.id}.qty`]?.choice ?? "one") || 1 : 1;
    items.push({ id: item.id, qty, options });
  }
  const kind = answers["place.kind"]?.choice;
  const place = (answers["place.want"]?.noul ?? 0) >= YES && kind && kind in PLACES ? kind : null;
  return { items, place, ms };
}
