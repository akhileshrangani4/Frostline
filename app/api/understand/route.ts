import { buildQuestions, readAnswers } from "@/lib/questions";

const QUESTIONS = buildQuestions();

export async function POST(request: Request) {
  const { said } = (await request.json()) as { said: string };
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return Response.json({ error: "TYPESAFE_API_KEY is not set" }, { status: 500 });

  const started = Date.now();
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.TYPESAFE_MODEL ?? "jev-latest",
      state: {
        setting: "A hotel guest is speaking to the in-room concierge. The speech may stop mid-sentence.",
        guest_said_so_far: said,
      },
      questions: QUESTIONS,
    }),
  });
  const ms = Date.now() - started;

  if (!res.ok) {
    return Response.json({ error: `Jev ${res.status}: ${await res.text()}` }, { status: 502 });
  }
  const data = await res.json();
  const understood = readAnswers(data.answers, ms);
  console.log(`[jev ${ms}ms] "${said}" -> ${JSON.stringify(understood.items)} place=${understood.place}`);
  if (new URL(request.url).searchParams.has("raw")) {
    const nouls = Object.fromEntries(
      Object.entries(data.answers as Record<string, { noul?: number }>)
        .filter(([, a]) => a.noul !== undefined)
        .map(([k, a]) => [k, Math.round(a.noul! * 100) / 100]),
    );
    return Response.json({ ...understood, nouls });
  }
  return Response.json(understood);
}
