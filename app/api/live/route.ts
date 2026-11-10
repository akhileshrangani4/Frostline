import { subscribeToConcierge } from "@/lib/live";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: string) => controller.enqueue(encoder.encode(message));
      send(": connected\n\n");
      const unsubscribe = subscribeToConcierge((update) => {
        send(`id: ${update.id}\ndata: ${JSON.stringify(update)}\n\n`);
      }, request.headers.get("last-event-id"));
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), 15000);
      const abort = () => {
        cleanup();
        controller.close();
      };
      cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", abort);
      };
      if (request.signal.aborted) {
        abort();
        return;
      }
      request.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
