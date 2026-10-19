// I binding del Worker: wrangler.toml dice dove vivono. Il secret
// CHIAVE_STAZIONE si imposta dalla dashboard o con
// `wrangler secret put CHIAVE_STAZIONE`, mai nel repo — vedi lora/README.md.
export interface Env {
  /* Il bucket pubblico: traccia.json e ultimo.json. Il pubblico lo legge
     da dati.cometa.gripe, attraverso la cache di Cloudflare, senza mai
     passare da questo Worker. */
  DATI: R2Bucket;
  /* Il bucket privato delle righe grezze, cosi' come arrivano dalle
     stazioni. Sta separato perche' tutto quello che e' nel bucket
     pubblico e' leggibile da chiunque, e qui finiscono anche le prove
     fatte a terra prima del lancio, con le loro posizioni. */
  GREZZO: R2Bucket;
  CHIAVE_STAZIONE?: string;
  ALLOWED_ORIGINS: string; // origini ammesse per CORS, separate da virgole
  ID_SONDA: string; // le righe con un altro id si scartano
  /* "true" per servire traccia.json e ultimo.json anche dal Worker: solo
     per le prove (wrangler dev, ambiente "prova"), dove non c'e' un
     dominio pubblico davanti al bucket. In produzione resta spento: il
     pubblico deve leggere dalla cache, non chiamare il Worker. */
  LETTURA_DAL_WORKER?: string;
}
