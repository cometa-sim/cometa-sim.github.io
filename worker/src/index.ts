import type { Env } from "./env";
import { handleCloudTile } from "./cloud-proxy";
export { SpotTracker } from "./tracker";

/* Un'unica istanza del Durable Object per tutto il sito: idFromName con
   un nome fisso restituisce sempre lo stesso id, quindi tutte le
   richieste (da qualunque visitatore) finiscono sulla stessa istanza —
   e' li' che vive il vero "una sola interrogazione per tutti". Le
   richieste /clouds/ non la toccano nemmeno: non hanno niente a che
   fare col tracker SPOT, vedi cloud-proxy.ts. */
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/clouds/")) return handleCloudTile(req, env, url, ctx);

    const id = env.TRACKER.idFromName("cometa-spot-2026");
    const stub = env.TRACKER.get(id);
    return stub.fetch(req);
  },
};
