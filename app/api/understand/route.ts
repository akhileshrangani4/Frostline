import { ConciergeError, understandGuest } from "@/lib/understand";

export async function POST(request: Request) {
  const { said } = (await request.json()) as { said: string };
  try {
    const { understood, answers } = await understandGuest(said);
    console.log(`[jev ${understood.ms}ms] "${said}" -> ${JSON.stringify(understood.items)} place=${understood.place}`);
    if (new URL(request.url).searchParams.has("raw")) {
      const nouls = Object.fromEntries(
        Object.entries(answers as Record<string, { noul?: number }>)
          .filter(([, a]) => a.noul !== undefined)
          .map(([k, a]) => [k, Math.round(a.noul! * 100) / 100]),
      );
      return Response.json({ ...understood, nouls });
    }
    return Response.json(understood);
  } catch (error) {
    if (!(error instanceof ConciergeError)) throw error;
    return Response.json({ error: error.message }, { status: error.status });
  }
}
