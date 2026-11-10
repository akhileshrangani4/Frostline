import { buildQuestions, readAnswers } from "./questions";

const QUESTIONS = buildQuestions();

export class ConciergeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function understandGuest(said: string, source: "voice" | "text" = "voice") {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw new ConciergeError("TYPESAFE_API_KEY is not set", 500);

  const started = Date.now();
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.TYPESAFE_MODEL ?? "jev-latest",
      state: {
        setting: source === "text"
          ? "A hotel guest sent a complete text message to the concierge."
          : "A hotel guest is speaking to the in-room concierge. The speech may stop mid-sentence.",
        guest_said_so_far: said,
      },
      questions: QUESTIONS,
    }),
  });
  const ms = Date.now() - started;

  if (!res.ok) {
    throw new ConciergeError(`Jev ${res.status}: ${await res.text()}`, 502);
  }
  const data = await res.json();
  return { understood: readAnswers(data.answers, ms), answers: data.answers };
}
