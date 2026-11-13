/* Il passaggio dall'app di oggi, sullo stesso indirizzo e quindi sullo stesso localStorage: alla prima apertura
   l'app nuova riprende da sola quello che l'altra aveva salvato sul telefono, prima di leggere qualunque cosa.
   - la chiave di Sillage («sillage:chiave»), se qui non ce n'è già una;
   - la coda delle scritture del diario («sillage:diario-coda»): passa nella coda nuova una volta sola (poi la
     vecchia si cancella), senza doppioni, e parte al primo invio;
   - la copia dei dati e del diario confermato («sillage:dati»), per aprire subito anche senza rete;
   - la posizione e il meteo per Consigliami («sillage:posto», «sillage:meteo»), stessa forma di oggi.
   Ogni passo vale solo se dall'altra parte c'è qualcosa: rifarlo non cambia niente. */
import type { Operazione } from "./diario/coda";

function leggi(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function scrivi(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* memoria piena: si riproverà alla prossima apertura */
  }
}
function json<T>(k: string): T | null {
  try {
    return JSON.parse(leggi(k) ?? "null");
  } catch {
    return null;
  }
}
const copiaSeManca = (vecchia: string, nuova: string) => {
  const v = leggi(vecchia);
  if (v && !leggi(nuova)) scrivi(nuova, v);
};

export function riprendiDallAppDiOggi() {
  copiaSeManca("sillage:chiave", "sillage-app:chiave");
  copiaSeManca("sillage:posto", "sillage-app:posto");
  copiaSeManca("sillage:meteo", "sillage-app:meteo");

  // la coda: si aggiungono le operazioni che non ci sono già (stessa operazione sulla stessa voce)
  const vecchia = json<Operazione[]>("sillage:diario-coda");
  if (Array.isArray(vecchia)) {
    if (vecchia.length) {
      const coda = json<Operazione[]>("sillage-app:diario-coda") ?? [];
      const gia = new Set(coda.map((o) => o.op + "|" + o.t));
      for (const o of vecchia) if (o && o.op && o.t && !gia.has(o.op + "|" + o.t)) coda.push({ ...o, t: String(o.t), id: +o.id });
      scrivi("sillage-app:diario-coda", JSON.stringify(coda));
    }
    // cancellata solo se la nuova coda è stata scritta davvero
    if (leggi("sillage-app:diario-coda") || !vecchia.length)
      try {
        localStorage.removeItem("sillage:diario-coda");
      } catch {
        /* resta: rifarlo non crea doppioni */
      }
  }

  // la copia dei dati dell'app di oggi: {quando, dati: {profumi, note, layering, consigli, diario}}
  const copia = json<{ dati?: Record<string, unknown> }>("sillage:dati");
  const d = copia?.dati;
  if (d && Array.isArray(d.profumi) && d.profumi.length) {
    if (!leggi("sillage-app:dati"))
      scrivi(
        "sillage-app:dati",
        JSON.stringify({ profumi: d.profumi, note: d.note ?? [], layering: d.layering ?? [], consigli: d.consigli ?? [], aggiornato: null })
      );
    if (Array.isArray(d.diario) && !leggi("sillage-app:diario")) scrivi("sillage-app:diario", JSON.stringify(d.diario));
  }
}
