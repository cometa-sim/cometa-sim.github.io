import type { Env } from "./env";
import { fetchSpotPage, fetchFakeSpot } from "./spot-client";
import { checkAuth, corsHeaders, jsonResponse, pointsToCsv, type Point } from "./util";

const POLL_INTERVAL_MS = 155_000; // i 150s richiesti da SPOT, piu' un margine
const MIN_INTERVAL_MS = 150_000; // mai due chiamate vere piu' vicine di questo
const BACKFILL_PAGE = 50; // quanti messaggi per pagina torna il feed SPOT
const BACKFILL_MAX_PAGES = 20; // 20*50 = 1000 messaggi, ben oltre un volo

/* Un'unica istanza (vedi idFromName in index.ts) tiene tutto: lo stato del
   polling, la tabella SQLite dei punti, e risponde a tutti gli endpoint —
   pubblici e protetti. E' il Durable Object che fa da "processo unico" al
   posto di ogni browser dei visitatori. */
export class SpotTracker implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {
    this.state.blockConcurrencyWhile(async () => this.ensureSchema());
  }

  private ensureSchema() {
    this.state.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS points (
        id TEXT PRIMARY KEY,
        time INTEGER NOT NULL,
        lat REAL,
        lon REAL,
        altitude REAL,
        messageType TEXT,
        batteryState TEXT,
        raw TEXT NOT NULL
      )
    `);
    this.state.storage.sql.exec(`CREATE INDEX IF NOT EXISTS idx_points_time ON points(time)`);
  }

  // ------------------------------------------------------------ routing

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = corsHeaders(req, this.env);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    try {
      if (path === "/track.json" && req.method === "GET") return this.handleTrackJson(cors);
      if (path === "/track.csv" && req.method === "GET") return this.handleTrackCsv(cors);

      // Tutto il resto e' protetto da token.
      if (!checkAuth(req, this.env)) return jsonResponse({ error: "non autorizzato" }, { status: 401 });

      if (path === "/track-all.json" && req.method === "GET") return this.handleTrackAll();
      if (path === "/start" && req.method === "POST") return this.handleStart();
      if (path === "/stop" && req.method === "POST") return this.handleStop();
      if (path === "/reset" && req.method === "POST") return this.handleReset();
      if (path === "/backfill" && req.method === "POST") return this.handleBackfill(req);
      if (path === "/public-from" && req.method === "POST") return this.handlePublicFrom(req);
      if (path === "/simulate" && req.method === "POST") return this.handleSimulate(req);

      return jsonResponse({ error: "non trovato" }, { status: 404 });
    } catch (err) {
      return jsonResponse({ error: String(err) }, { status: 500 });
    }
  }

  // ------------------------------------------------------- endpoint pubblici

  /* Solo i punti con time >= publicFrom; senza publicFrom impostato,
     nessun punto — i test prima del lancio restano privati di default. */
  private async handleTrackJson(cors: HeadersInit): Promise<Response> {
    const publicFrom = (await this.state.storage.get<number>("publicFrom")) ?? null;
    const points = publicFrom == null ? [] : this.selectPoints(publicFrom);
    const meta = await this.metaForPublic();
    return jsonResponse(
      { points, ...meta },
      { headers: { "Cache-Control": "public, max-age=30" } },
      cors
    );
  }

  private async handleTrackCsv(cors: HeadersInit): Promise<Response> {
    const publicFrom = (await this.state.storage.get<number>("publicFrom")) ?? null;
    const points = publicFrom == null ? [] : this.selectPoints(publicFrom);
    const csv = pointsToCsv(points);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cometa-track.csv"',
        "Cache-Control": "public, max-age=30",
        ...cors,
      },
    });
  }

  private async metaForPublic() {
    const lastFetch = (await this.state.storage.get<number>("lastFetchMs")) ?? null;
    const lastFetchOk = (await this.state.storage.get<boolean>("lastFetchOk")) ?? null;
    const pollingActive = (await this.state.storage.get<boolean>("pollingActive")) ?? false;
    const lastRow = this.state.storage.sql
      .exec<{ time: number }>(`SELECT time FROM points ORDER BY time DESC LIMIT 1`)
      .toArray();
    return {
      last_fetch: lastFetch == null ? null : new Date(lastFetch).toISOString(),
      last_fetch_ok: lastFetchOk,
      last_point_time: lastRow[0]?.time ?? null,
      polling_active: pollingActive,
    };
  }

  // ------------------------------------------------------ endpoint protetti

  private async handleTrackAll(): Promise<Response> {
    const points = this.selectPoints(0);
    const meta = await this.metaForPublic();
    return jsonResponse({ points, ...meta });
  }

  /* Avvia il polling: segna attivo e programma subito il primo alarm. Se
     c'era gia' un lastFetchMs recente (riavvio ravvicinato) il guardiano
     nell'alarm() si occupa comunque di non richiamare SPOT troppo presto. */
  private async handleStart(): Promise<Response> {
    await this.state.storage.put("pollingActive", true);
    await this.state.storage.setAlarm(Date.now());
    return jsonResponse({ ok: true, polling_active: true });
  }

  private async handleStop(): Promise<Response> {
    await this.state.storage.put("pollingActive", false);
    await this.state.storage.deleteAlarm();
    return jsonResponse({ ok: true, polling_active: false });
  }

  /* Da usare dopo le prove, prima del giorno vero: cancella tutti i punti
     salvati. Non tocca pollingActive/publicFrom/simulate. */
  private async handleReset(): Promise<Response> {
    this.state.storage.sql.exec(`DELETE FROM points`);
    return jsonResponse({ ok: true });
  }

  /* Riscarica l'intero volo via paginazione (start=51,101,...) o per
     intervallo di date, e lo reinserisce (upsert, stessa deduplica del
     polling) — colma i buchi lasciati da eventuali chiamate fallite,
     senza duplicare quello che c'e' gia'. */
  private async handleBackfill(req: Request): Promise<Response> {
    const body: { startDate?: string; endDate?: string } = await req
      .json<{ startDate?: string; endDate?: string }>()
      .catch(() => ({}) as { startDate?: string; endDate?: string });
    let total = 0;
    if (body.startDate || body.endDate) {
      const params: Record<string, string> = {};
      if (body.startDate) params.startDate = body.startDate;
      if (body.endDate) params.endDate = body.endDate;
      const { points, raws } = await fetchSpotPage(this.env, params);
      total += this.upsertPoints(points, raws);
    } else {
      for (let page = 0; page < BACKFILL_MAX_PAGES; page++) {
        const start = page * BACKFILL_PAGE + 1;
        const params: Record<string, string> = page === 0 ? {} : { start: String(start) };
        const { points, raws } = await fetchSpotPage(this.env, params);
        if (points.length === 0) break;
        total += this.upsertPoints(points, raws);
        if (points.length < BACKFILL_PAGE) break; // ultima pagina
      }
    }
    return jsonResponse({ ok: true, upserted: total });
  }

  private async handlePublicFrom(req: Request): Promise<Response> {
    const body = await req.json<{ time: number | null }>().catch(() => null);
    if (!body || (body.time !== null && typeof body.time !== "number")) {
      return jsonResponse({ error: "body atteso: {time: <unix secondi>|null}" }, { status: 400 });
    }
    await this.state.storage.put("publicFrom", body.time);
    return jsonResponse({ ok: true, publicFrom: body.time });
  }

  private async handleSimulate(req: Request): Promise<Response> {
    const body = await req.json<{ enabled: boolean }>().catch(() => null);
    if (!body || typeof body.enabled !== "boolean") {
      return jsonResponse({ error: "body atteso: {enabled: true|false}" }, { status: 400 });
    }
    await this.state.storage.put("simulate", body.enabled);
    if (body.enabled && (await this.state.storage.get("simStartS")) == null) {
      await this.state.storage.put("simStartS", Math.floor(Date.now() / 1000));
    }
    if (!body.enabled) await this.state.storage.delete("simStartS");
    return jsonResponse({ ok: true, simulate: body.enabled });
  }

  // --------------------------------------------------------------- polling

  /* Il cuore del "una sola interrogazione per tutti": i Cron Trigger di
     Cloudflare hanno granularita' di un minuto (non permettono 150s), quindi
     il ritmo lo tiene l'alarm del Durable Object, che si riprogramma da
     solo a ogni esecuzione. Il guardiano su lastFetchMs garantisce i 150s
     minimi anche con alarm duplicati o un riavvio del Worker. */
  async alarm(): Promise<void> {
    const active = (await this.state.storage.get<boolean>("pollingActive")) ?? false;
    if (!active) return; // non si riprogramma da solo: ci pensa /start

    const lastFetchMs = (await this.state.storage.get<number>("lastFetchMs")) ?? 0;
    const now = Date.now();
    if (now - lastFetchMs < MIN_INTERVAL_MS) {
      // alarm scattato in anticipo (duplicato, riavvio): aspetta il resto, non richiama SPOT
      await this.state.storage.setAlarm(lastFetchMs + POLL_INTERVAL_MS);
      return;
    }

    await this.state.storage.put("lastFetchMs", now);
    try {
      const simulate = (await this.state.storage.get<boolean>("simulate")) ?? false;
      let points: Point[], raws: Map<string, unknown>;
      if (simulate) {
        const simStartS = (await this.state.storage.get<number>("simStartS")) ?? Math.floor(now / 1000);
        ({ points, raws } = fetchFakeSpot(simStartS, Math.floor(now / 1000)));
      } else {
        ({ points, raws } = await fetchSpotPage(this.env));
      }
      this.upsertPoints(points, raws);
      await this.state.storage.put("lastFetchOk", true);
      await this.state.storage.delete("lastError");
    } catch (err) {
      // Un giro fallito non perde i dati gia' salvati: si riprova al prossimo,
      // sempre rispettando i 150s (vedi il guardiano sopra).
      await this.state.storage.put("lastFetchOk", false);
      await this.state.storage.put("lastError", String(err));
    }
    await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
  }

  // ----------------------------------------------------------------- dati

  /* Upsert per id: un punto gia' visto si aggiorna (nel raro caso in cui
     SPOT lo ritrasmetta corretto), uno nuovo si inserisce. Mai scartati
     ne' corretti i valori di quota, anche se sembrano anomali. */
  private upsertPoints(points: Point[], raws: Map<string, unknown>): number {
    let n = 0;
    for (const p of points) {
      this.state.storage.sql.exec(
        `INSERT INTO points (id, time, lat, lon, altitude, messageType, batteryState, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           time=excluded.time, lat=excluded.lat, lon=excluded.lon, altitude=excluded.altitude,
           messageType=excluded.messageType, batteryState=excluded.batteryState, raw=excluded.raw`,
        p.id, p.time, p.lat, p.lon, p.altitude, p.messageType, p.batteryState,
        JSON.stringify(raws.get(p.id) ?? null)
      );
      n++;
    }
    return n;
  }

  private selectPoints(fromTime: number): Point[] {
    // Le colonne corrispondono 1:1 ai campi di Point: SqlStorageCursor non
    // accetta Point come generico (niente index signature), si tipizza qui.
    const rows = this.state.storage.sql
      .exec(
        `SELECT id, time, lat, lon, altitude, messageType, batteryState FROM points WHERE time >= ? ORDER BY time ASC`,
        fromTime
      )
      .toArray();
    return rows as unknown as Point[];
  }
}
