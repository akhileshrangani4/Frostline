import { findPlaces } from "@/lib/places";
import { ConciergeError } from "@/lib/understand";

export async function POST(request: Request) {
  const { kind, said } = (await request.json()) as { kind: string; said: string };
  try {
    return Response.json({ places: await findPlaces(kind, said) });
  } catch (error) {
    if (!(error instanceof ConciergeError)) throw error;
    return Response.json({ error: error.message }, { status: error.status });
  }
}
