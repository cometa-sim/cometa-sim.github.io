import type { Env } from "./env";
import { fetchSpotPage, fetchFakeSpot, parseSpotJson, parseDataPushXml } from "./spot-client";
import { checkAuth, corsHeaders, jsonResponse, pointsToCsv, type Point } from "./util";
import { checkWsseSignature, WSSE_FRESHNESS_MS } from "./wsse";

const POLL_INTERVAL_MS = 155_000; // i 150s richiesti da SPOT, piu' un margine
const MIN_INTERVAL_MS = 150_000; // mai due chiamate vere piu' vicine di questo
const PUSH_FETCH_DELAY_MS = 5_000; // dopo un Data Push, un attimo prima di leggere il feed (la quota)
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

  /* I CORS si applicano qui, a ogni risposta indistintamente (anche un
     401 o un 404): da quando la pagina di amministrazione chiama anche
     gli endpoint protetti dal browser, non solo quelli pubblici, serve
     che il browser possa sempre leggere l'esito — il Bearer token
     resta il vero controllo d'accesso, i CORS header non bypassano
     nulla, dicono solo al browser chi puo' leggere la risposta. */
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const cors = corsHeaders(req, this.env);

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    let res: Response;
    try {
      if (path === "/track.json" && req.method === "GET") res = await this.handleTrackJson();
      else if (path === "/track.csv" && req.method === "GET") res = await this.handleTrackCsv();
      // SPOT manda qui il Data Push: autenticato con la firma X-WSSE
      // (vedi wsse.ts), non con ADMIN_TOKEN — percio' prima del gate sotto.
      else if (path === "/" && req.method === "POST") res = await this.handleDataPush(req);
      // Tutto il resto e' protetto da token.
      else if (!checkAuth(req, this.env)) res = jsonResponse({ error: "non autorizzato" }, { status: 401 });
      else if (path === "/track-all.json" && req.method === "GET") res = await this.handleTrackAll();
      else if (path === "/start" && req.method === "POST") res = await this.handleStart();
      else if (path === "/stop" && req.method === "POST") res = await this.handleStop();
      else if (path === "/reset" && req.method === "POST") res = await this.handleReset();
      else if (path === "/backfill" && req.method === "POST") res = await this.handleBackfill(req);
      else if (path === "/public-from" && req.method === "POST") res = await this.handlePublicFrom(req);
      else if (path === "/simulate" && req.method === "POST") res = await this.handleSimulate(req);
      else if (path === "/claim" && req.method === "POST") res = await this.handleClaim();
      else if (path === "/ingest" && req.method === "POST") res = await this.handleIngest(req);
      else res = jsonResponse({ error: "non trovato" }, { status: 404 });
    } catch (err) {
      res = jsonResponse({ error: String(err) }, { status: 500 });
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v as string);
    return res;
  }

  // ------------------------------------------------------- endpoint pubblici

  /* Solo i punti con time >= publicFrom; senza publicFrom impostato,
     nessun punto — i test prima del lancio restano privati di default. */
  private async handleTrackJson(): Promise<Response> {
    const publicFrom = (await this.state.storage.get<number>("publicFrom")) ?? null;
    const points = publicFrom == null ? [] : this.selectPoints(publicFrom);
    const meta = await this.metaForPublic();
    return jsonResponse({ points, ...meta }, { headers: { "Cache-Control": "public, max-age=30" } });
  }

  private async handleTrackCsv(): Promise<Response> {
    const publicFrom = (await this.state.storage.get<number>("publicFrom")) ?? null;
    const points = publicFrom == null ? [] : this.selectPoints(publicFrom);
    const csv = pointsToCsv(points);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cometa-track.csv"',
        "Cache-Control": "public, max-age=30",
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

  /* Come track.json ma senza il filtro PUBLIC_FROM, e con in piu'
     l'ultimo errore registrato — per la pagina di amministrazione. */
  private async handleTrackAll(): Promise<Response> {
    const points = this.selectPoints(0);
    const meta = await this.metaForPublic();
    const lastError = (await this.state.storage.get<string>("lastError")) ?? null;
    return jsonResponse({ points, ...meta, last_error: lastError });
  }

  /* Avvia il polling: segna attivo e programma subito il primo alarm. Se
     SPOT e' stato interrogato da poco (da qui o da una pagina admin),
     reserveSpotCall() nell'alarm() fa comunque aspettare il resto. */
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
      total += this.upsertPoints(points, raws).processed;
    } else {
      for (let page = 0; page < BACKFILL_MAX_PAGES; page++) {
        const start = page * BACKFILL_PAGE + 1;
        const params: Record<string, string> = page === 0 ? {} : { start: String(start) };
        const { points, raws } = await fetchSpotPage(this.env, params);
        if (points.length === 0) break;
        total += this.upsertPoints(points, raws).processed;
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

  /* Il permesso di chiamare SPOT: concesso solo se sono passati almeno
     150s (MIN_INTERVAL_MS, lo stesso limite di SPOT) dall'ultimo
     permesso concesso — non dall'ultimo /ingest andato a buon fine: il
     permesso e' speso appena concesso, anche se chi lo ottiene non
     arriva mai a chiamare /ingest (pagina chiusa, rete caduta), cosi'
     nessun'altra pagina di amministrazione aperta in parallelo puo'
     richiamare SPOT troppo presto. Al sicuro con piu' pagine aperte
     insieme: un Durable Object processa le proprie richieste una alla
     volta (non in parallelo) finche' non si passa un'opzione esplicita
     per toglierlo, che qui non si usa — get e put dello storage non
     vengono mai interallacciati da un'altra richiesta nel mezzo. */
  private async handleClaim(): Promise<Response> {
    const wait = await this.reserveSpotCall();
    if (wait > 0) return jsonResponse({ granted: false, retry_after_s: Math.ceil(wait / 1000) });
    return jsonResponse({ granted: true });
  }

  /* L'unico limite verso SPOT, condiviso da tutti quelli che lo
     interrogano: l'alarm del Worker (alarm() sotto) e le pagine di
     amministrazione (/claim). Se sono passati almeno MIN_INTERVAL_MS
     dall'ultima chiamata concessa a chiunque, prenota questa e torna 0;
     altrimenti non prenota niente e dice quanti ms mancano. La chiave
     resta "lastClaimMs" perche' e' quella gia' in storage. */
  private async reserveSpotCall(): Promise<number> {
    const last = (await this.state.storage.get<number>("lastClaimMs")) ?? 0;
    const now = Date.now();
    if (now - last < MIN_INTERVAL_MS) return MIN_INTERVAL_MS - (now - last);
    await this.state.storage.put("lastClaimMs", now);
    return 0;
  }

  /* La pagina di amministrazione, quando interroga SPOT dal browser
     (la riserva, se il Worker non riesce a farlo da solo), manda qui
     cosa le ha risposto SPOT, cosi' com'e'. "ok" dice se e' arrivata una risposta
     HTTP qualunque da SPOT (anche di errore applicativo): se e' false
     il fetch dal browser e' fallito del tutto (rete, CORS) e non c'e'
     nessun corpo da leggere. Un esito negativo si registra comunque
     (spot_ok:false, lastError) — non si rifiuta l'ingest — cosi'
     track.json lo riporta invece di restare silenziosamente indietro. */
  private async handleIngest(req: Request): Promise<Response> {
    const body = await req
      .json<{ ok: boolean; status?: number; body?: unknown; error?: string }>()
      .catch(() => null);
    if (!body || typeof body.ok !== "boolean") {
      return jsonResponse({ error: "body atteso: {ok, status?, body?, error?}" }, { status: 400 });
    }
    await this.state.storage.put("lastFetchMs", Date.now());

    if (!body.ok) {
      console.error(`[SPOT via admin] fetch fallito: ${body.error ?? "motivo sconosciuto"}`);
      await this.state.storage.put("lastFetchOk", false);
      await this.state.storage.put("lastError", body.error ?? "fetch fallito");
      return jsonResponse({ ok: true, spot_ok: false, upserted: 0, received: 0 });
    }
    if (body.status != null && (body.status < 200 || body.status >= 300)) {
      const bodyText = typeof body.body === "string" ? body.body : JSON.stringify(body.body ?? null);
      console.error(`[SPOT via admin] HTTP ${body.status}\n${bodyText}`);
      await this.state.storage.put("lastFetchOk", false);
      await this.state.storage.put("lastError", `SPOT HTTP ${body.status}: ${bodyText.slice(0, 300)}`);
      return jsonResponse({ ok: true, spot_ok: false, upserted: 0, received: 0 });
    }
    try {
      const { points, raws } = parseSpotJson(body.body);
      const { inserted } = this.upsertPoints(points, raws);
      await this.state.storage.put("lastFetchOk", true);
      await this.state.storage.delete("lastError");
      return jsonResponse({ ok: true, spot_ok: true, upserted: inserted, received: points.length });
    } catch (err) {
      await this.state.storage.put("lastFetchOk", false);
      await this.state.storage.put("lastError", String(err));
      return jsonResponse({ ok: true, spot_ok: false, upserted: 0, received: 0 });
    }
  }

  /* SPOT manda qui, da solo, un messaggio XML quasi appena arriva (Data
     Push — vedi worker/README.md), invece di dover andare a chiederlo.
     Autenticato con la firma X-WSSE che SPOT stesso manda a ogni
     chiamata (checkWsseSignature + nonce anti-replay qui sotto), non
     con ADMIN_TOKEN.
     IMPORTANTE: il Data Push di SPOT non manda MAI la quota (altitude
     non esiste nel suo schema XML) — la quota arriva solo dal feed
     REST. Per questo, a ogni push con punti nuovi, si chiede all'alarm
     una lettura del feed appena possibile (schedulePushFetch): la
     posizione arriva subito dal push, la quota dello stesso messaggio
     poco dopo dal feed. upsertPoints() preserva una quota gia' salvata
     invece di sovrascriverla con l'assenza. */
  private async handleDataPush(req: Request): Promise<Response> {
    const check = await checkWsseSignature(req.headers.get("X-WSSE"), this.env);
    if (!check.ok) {
      console.error(`[SPOT Data Push] rifiutato: ${check.reason}`);
      return jsonResponse({ error: "non autorizzato" }, { status: 401 });
    }
    const fresh = await this.checkAndStoreNonce(check.nonceB64 as string);
    if (!fresh) {
      console.error(`[SPOT Data Push] nonce gia' visto — scartato (possibile replay)`);
      return jsonResponse({ error: "non autorizzato" }, { status: 401 });
    }

    const routerMessageMode = req.headers.get("routerMessageMode") ?? "?";
    const routerMessageSeq = req.headers.get("routerMessageSeq") ?? "?";
    const xml = await req.text();
    try {
      let { points, raws } = parseDataPushXml(xml);
      if (this.env.SPOT_PUSH_ESN) {
        points = points.filter((p) => (raws.get(p.id) as { esn?: string } | undefined)?.esn === this.env.SPOT_PUSH_ESN);
      }
      const { inserted } = this.upsertPoints(points, raws);
      await this.state.storage.put("lastFetchMs", Date.now());
      await this.state.storage.put("lastFetchOk", true);
      await this.state.storage.delete("lastError");
      console.log(`[SPOT Data Push] ${routerMessageMode}/${routerMessageSeq} — ${points.length} ricevuti, ${inserted} nuovi`);
      if (points.length) await this.schedulePushFetch();
      return new Response("OK", { status: 200 });
    } catch (err) {
      console.error(`[SPOT Data Push] errore nel parsing XML: ${String(err)}\n${xml.slice(0, 2000)}`);
      await this.state.storage.put("lastFetchOk", false);
      await this.state.storage.put("lastError", String(err));
      return jsonResponse({ error: String(err) }, { status: 500 });
    }
  }

  /* Anti-replay del Data Push: un nonce gia' visto viene rifiutato (vedi
     wsse.ts). I nonce si accumulano in storage con il loro orario di
     arrivo; qui si scartano quelli piu' vecchi della stessa finestra di
     freschezza usata per accettarli (un'ora, raccomandata da SPOT),
     cosi' la tabella non cresce senza limite per tutto il volo. */
  private async checkAndStoreNonce(nonceB64: string): Promise<boolean> {
    const key = `pushNonce:${nonceB64}`;
    if ((await this.state.storage.get<number>(key)) != null) return false;
    const now = Date.now();
    await this.state.storage.put(key, now);
    const all = await this.state.storage.list<number>({ prefix: "pushNonce:" });
    const stale: string[] = [];
    for (const [k, ts] of all) if (now - ts > WSSE_FRESHNESS_MS) stale.push(k);
    if (stale.length) await this.state.storage.delete(stale);
    return true;
  }

  // --------------------------------------------------------------- polling

  /* Dopo un Data Push: una lettura del feed appena il limite dei 150s lo
     permette, per avere la quota del messaggio appena arrivato. Vale
     anche con il polling periodico fermo (/stop): in quel caso e' una
     lettura sola, poi l'alarm non si riprogramma. Un Durable Object ha
     un solo alarm: se ce n'e' gia' uno piu' vicino si lascia quello. */
  private async schedulePushFetch(): Promise<void> {
    if (this.env.INTERNAL_POLLING_ENABLED !== "true") return;
    await this.state.storage.put("pushFetchPending", true);
    const last = (await this.state.storage.get<number>("lastClaimMs")) ?? 0;
    const at = Math.max(Date.now() + PUSH_FETCH_DELAY_MS, last + MIN_INTERVAL_MS);
    const current = await this.state.storage.getAlarm();
    if (current == null || current > at) await this.state.storage.setAlarm(at);
  }

  /* Il Worker interroga SPOT da solo: SPOT ha tolto il blocco 403 sulle
     richieste dai Worker di Cloudflare (verificato a ottobre 2026). Due
     motivi per farlo:
     - il polling periodico, ogni ~155s, attivo tra /start e /stop: la
       rete di sicurezza se un Data Push tarda o si perde;
     - la lettura subito dopo un Data Push (pushFetchPending), per la
       quota, che il push non manda.
     I Cron Trigger di Cloudflare hanno granularita' di un minuto (non
     permettono 150s), quindi il ritmo lo tiene l'alarm del Durable
     Object, che si riprogramma da solo. Il limite dei 150s e' quello
     condiviso con /claim (reserveSpotCall): con una pagina di
     amministrazione aperta in parallelo, SPOT non viene comunque mai
     interrogato piu' di una volta ogni 150s in tutto.
     INTERNAL_POLLING_ENABLED diverso da "true" spegne tutto (se SPOT
     tornasse a bloccare i Worker): resta solo la pagina admin. */
  async alarm(): Promise<void> {
    if (this.env.INTERNAL_POLLING_ENABLED !== "true") return;

    const active = (await this.state.storage.get<boolean>("pollingActive")) ?? false;
    const pending = (await this.state.storage.get<boolean>("pushFetchPending")) ?? false;
    if (!active && !pending) return; // non si riprogramma da solo: ci pensa /start o il prossimo push

    const wait = await this.reserveSpotCall();
    if (wait > 0) {
      // qualcun altro (una pagina admin) ha appena chiamato SPOT: si aspetta il resto
      await this.state.storage.setAlarm(Date.now() + wait + (active ? POLL_INTERVAL_MS - MIN_INTERVAL_MS : 0));
      return;
    }

    await this.state.storage.delete("pushFetchPending");
    const now = Date.now();
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
      // sempre rispettando i 150s (vedi reserveSpotCall).
      console.error(`[SPOT dal Worker] ${String(err)}`);
      await this.state.storage.put("lastFetchOk", false);
      await this.state.storage.put("lastError", String(err));
    }
    if (active) await this.state.storage.setAlarm(Date.now() + POLL_INTERVAL_MS);
  }

  // ----------------------------------------------------------------- dati

  /* Upsert per id: un punto gia' visto si aggiorna (nel raro caso in cui
     SPOT lo ritrasmetta corretto), uno nuovo si inserisce. Mai scartati
     ne' corretti i valori di quota, anche se sembrano anomali — tranne
     un caso voluto: il Data Push (vedi handleDataPush) non manda MAI la
     quota, quindi un suo upsert non deve cancellare una quota gia'
     salvata dal feed REST per lo stesso id; COALESCE(excluded.altitude,
     points.altitude) tiene la nuova quota se c'e', altrimenti quella
     vecchia — mai un buco dove prima c'era un valore vero.
     "inserted" (non "processed") e' il numero di punti DAVVERO nuovi —
     serve a /ingest per dire alla pagina di amministrazione quanti
     punti nuovi sono arrivati in questo giro, non solo quanti ne
     conteneva la risposta di SPOT (che ne manda sempre fino a 50,
     quasi tutti gia' visti). */
  private upsertPoints(points: Point[], raws: Map<string, unknown>): { processed: number; inserted: number } {
    if (points.length === 0) return { processed: 0, inserted: 0 };
    const ids = points.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");
    const existing = new Set(
      this.state.storage.sql
        .exec(`SELECT id FROM points WHERE id IN (${placeholders})`, ...ids)
        .toArray()
        .map((r) => (r as { id: string }).id)
    );
    let inserted = 0;
    for (const p of points) {
      if (!existing.has(p.id)) inserted++;
      this.state.storage.sql.exec(
        `INSERT INTO points (id, time, lat, lon, altitude, messageType, batteryState, raw)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           time=excluded.time, lat=excluded.lat, lon=excluded.lon,
           altitude=COALESCE(excluded.altitude, points.altitude),
           messageType=excluded.messageType, batteryState=excluded.batteryState, raw=excluded.raw`,
        p.id, p.time, p.lat, p.lon, p.altitude, p.messageType, p.batteryState,
        JSON.stringify(raws.get(p.id) ?? null)
      );
    }
    return { processed: points.length, inserted };
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
