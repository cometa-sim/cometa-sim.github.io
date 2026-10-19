/* Worker della telemetria LoRa: riceve le righe dalle stazioni di terra
   e mantiene su R2 i due file che la mappa del sito legge. Il pubblico
   non passa mai di qui: legge traccia.json e ultimo.json da
   dati.cometa.gripe, attraverso la cache di Cloudflare. Questo Worker
   lo chiamano solo le stazioni (e il simulatore), una volta ogni
   qualche secondo. Vedi lora/README.md. */
import type { Env } from "./env.ts";
import { corsHeaders, rispostaJson, chiaveValida } from "./util.ts";
import { aggiungiPunti, azzera, salvaGrezzo, TroppiTentativi, FILE_TRACCIA, FILE_ULTIMO } from "./archivio.ts";
import { tracciaVuota } from "./traccia.ts";
import type { Ricevuta } from "./traccia.ts";
import { analizzaRiga } from "../../formato/formato.js";

/* Limiti del lotto. Una riga ogni 5 s fa 720 righe l'ora: 5000 bastano
   per una stazione rimasta senza rete per piu' di sei ore, e restano
   sotto il mezzo megabyte. */
const RIGHE_PER_LOTTO = 5000;
const BYTE_PER_LOTTO = 2_000_000;
const LUNGHEZZA_GREZZA = 1000; // oltre, non e' una riga della sonda: si tronca nel grezzo
const RE_STAZIONE = /^[a-z0-9][a-z0-9-]{0,31}$/;

/* L'ora di ricezione la da' il computer della stazione, non il Worker:
   una stazione rimasta senza rete manda le righe in ritardo, e l'ora
   d'arrivo al Worker sarebbe sbagliata. Ma l'orologio di un telefono o
   di un portatile puo' essere sbagliato: un'ora nel futuro, o vecchia di
   giorni, si sostituisce con l'ora del Worker. Due giorni coprono
   qualunque ritardo di rete realistico. */
const FUTURO_AMMESSO_S = 120;
const PASSATO_AMMESSO_S = 2 * 86400;

function oraRicezione(tMs: number, adesso: number): number {
  const t = Math.round(tMs / 1000);
  if (!Number.isFinite(t) || t > adesso + FUTURO_AMMESSO_S || t < adesso - PASSATO_AMMESSO_S) return adesso;
  return t;
}

interface Lotto {
  stazione: string;
  righe: { t: number; r: string }[];
}

function leggiLotto(corpo: unknown): Lotto | string {
  if (!corpo || typeof corpo !== "object") return "il corpo deve essere un oggetto JSON";
  const { stazione, righe } = corpo as Record<string, unknown>;
  if (typeof stazione !== "string" || !RE_STAZIONE.test(stazione)) {
    return "stazione: minuscole, cifre e trattini, al massimo 32 caratteri";
  }
  if (!Array.isArray(righe) || righe.length === 0) return "righe: serve un array non vuoto";
  if (righe.length > RIGHE_PER_LOTTO) return `righe: al massimo ${RIGHE_PER_LOTTO} per lotto`;
  const lette: Lotto["righe"] = [];
  for (const x of righe) {
    if (!x || typeof x !== "object") return "ogni riga deve essere {t, r}";
    const { t, r } = x as Record<string, unknown>;
    if (typeof t !== "number" || typeof r !== "string") return "ogni riga deve essere {t: numero, r: testo}";
    lette.push({ t, r: r.slice(0, LUNGHEZZA_GREZZA) });
  }
  return { stazione, righe: lette };
}

async function riceviRighe(req: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  const lunghezza = Number(req.headers.get("Content-Length") || "0");
  if (lunghezza > BYTE_PER_LOTTO) return rispostaJson({ ok: false, errore: "lotto troppo grande" }, 413, cors);
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return rispostaJson({ ok: false, errore: "JSON non valido" }, 400, cors);
  }
  const lotto = leggiLotto(corpo);
  if (typeof lotto === "string") return rispostaJson({ ok: false, errore: lotto }, 400, cors);

  const adessoData = new Date();
  const adesso = Math.floor(adessoData.getTime() / 1000);

  /* Prima il grezzo, poi tutto il resto: se qualcosa va storto dopo,
     le righe sono gia' al sicuro. La stazione, non ricevendo risposta,
     rimanda lo stesso lotto: nel grezzo finisce due volte (e' una copia,
     non importa), nella traccia una sola, perche' i doppioni si
     scartano. Rimandare e' quindi sempre innocuo. */
  await salvaGrezzo(env.GREZZO, lotto.stazione, lotto.righe, adessoData);

  const nuove: Ricevuta[] = [];
  const motivi: Record<string, number> = {};
  for (const { t, r } of lotto.righe) {
    const esito = analizzaRiga(r);
    if (!esito.ok) {
      motivi[esito.errore] = (motivi[esito.errore] || 0) + 1;
      continue;
    }
    /* Sullo stesso canale puo' trasmettere qualcun altro, o una seconda
       sonda di prova: l'id serve proprio a distinguerle. */
    if (esito.dati.id !== env.ID_SONDA) {
      const m = "id diverso da " + env.ID_SONDA;
      motivi[m] = (motivi[m] || 0) + 1;
      continue;
    }
    nuove.push({ t: oraRicezione(t, adesso), dati: esito.dati });
  }
  const scartate = lotto.righe.length - nuove.length;

  let aggiunte = 0;
  let totale: number | null = null;
  if (nuove.length) {
    const esito = await aggiungiPunti(env.DATI, env.ID_SONDA, nuove, adesso);
    aggiunte = esito.aggiunte;
    totale = esito.traccia.righe.length;
  }
  return rispostaJson(
    {
      ok: true,
      ricevute: lotto.righe.length,
      valide: nuove.length,
      aggiunte,
      doppioni: nuove.length - aggiunte,
      scartate,
      motivi,
      totale,
    },
    200,
    cors,
  );
}

/* Solo per le prove (LETTURA_DAL_WORKER): in produzione questi file si
   leggono da dati.cometa.gripe. Se il file non c'e' ancora si risponde
   con uno vuoto, come fara' la mappa vera prima del primo pacchetto. */
async function serviFile(nome: string, env: Env, cors: Record<string, string>): Promise<Response> {
  const obj = await env.DATI.get(nome);
  const testo = obj ? await obj.text() : JSON.stringify(nome === FILE_TRACCIA ? tracciaVuota(env.ID_SONDA) : null);
  return new Response(testo, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (req.method === "GET" && env.LETTURA_DAL_WORKER === "true" && (url.pathname === "/" + FILE_TRACCIA || url.pathname === "/" + FILE_ULTIMO)) {
      return serviFile(url.pathname.slice(1), env, cors);
    }

    const protetti = ["/righe", "/verifica", "/azzera"];
    if (!protetti.includes(url.pathname)) return rispostaJson({ ok: false, errore: "non trovato" }, 404, cors);
    if (!chiaveValida(req, env)) return rispostaJson({ ok: false, errore: "chiave non valida" }, 401, cors);

    try {
      /* La stazione lo chiama all'apertura, per dire subito se la chiave
         digitata e' giusta, invece di scoprirlo al primo lotto. */
      if (url.pathname === "/verifica" && req.method === "GET") {
        return rispostaJson({ ok: true, id_sonda: env.ID_SONDA }, 200, cors);
      }
      if (url.pathname === "/righe" && req.method === "POST") return await riceviRighe(req, env, cors);
      if (url.pathname === "/azzera" && req.method === "POST") {
        /* La conferma scritta evita un azzeramento per sbaglio, per
           esempio un comando curl ripescato dalla cronologia e lanciato
           a volo in corso. */
        const corpo = (await req.json().catch(() => null)) as { conferma?: unknown } | null;
        if (!corpo || corpo.conferma !== "azzera") {
          return rispostaJson({ ok: false, errore: 'serve {"conferma": "azzera"}' }, 400, cors);
        }
        const t = await azzera(env.DATI, env.ID_SONDA, Math.floor(Date.now() / 1000));
        return rispostaJson({ ok: true, revisione: t.revisione }, 200, cors);
      }
      return rispostaJson({ ok: false, errore: "metodo non ammesso" }, 405, cors);
    } catch (err) {
      /* 503 e non 500 quando le stazioni si sono pestate i piedi troppe
         volte: e' temporaneo, e la stazione riprova da sola. */
      const status = err instanceof TroppiTentativi ? 503 : 500;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[lora] errore:", msg);
      return rispostaJson({ ok: false, errore: msg }, status, cors);
    }
  },
};

