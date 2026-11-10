import { Suspense } from "react";
import { connection } from "next/server";
import { getConciergeShare } from "@/lib/live";
import { Nearby } from "../../concierge-cards";

type ShareProps = { params: Promise<{ id: string }> };

async function SharedResults({ params }: ShareProps) {
  await connection();
  const { id } = await params;
  const update = getConciergeShare(id);

  if (!update) {
    return (
      <div className="greet">
        <h1>Link expired</h1>
        <p>Ask Muse for a fresh concierge link.</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <Nearby kind={update.kind} places={update.places} />
    </div>
  );
}

export default function SharePage({ params }: ShareProps) {
  return (
    <main className="room">
      <div className="wallpaper" aria-hidden />
      <header>
        <span className="left">
          <b>Palace Hotel</b>
          <span>Muse concierge</span>
        </span>
      </header>
      <section className="stage">
        <Suspense fallback={<p>Loading concierge results…</p>}>
          <SharedResults params={params} />
        </Suspense>
      </section>
    </main>
  );
}
