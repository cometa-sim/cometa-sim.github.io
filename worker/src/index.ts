import type { Env } from "./env";
export { SpotTracker } from "./tracker";

/* Un'unica istanza del Durable Object per tutto il sito: idFromName con
   un nome fisso restituisce sempre lo stesso id, quindi tutte le
   richieste (da qualunque visitatore) finiscono sulla stessa istanza —
   e' li' che vive il vero "una sola interrogazione per tutti". */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const id = env.TRACKER.idFromName("cometa-spot-2026");
    const stub = env.TRACKER.get(id);
    return stub.fetch(req);
  },
};
